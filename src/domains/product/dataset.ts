import 'server-only'
/**
 * Product insights for the current visitor: the synthetic sample, or measured
 * from their imported events / experiment results / backlog.
 *
 * Event analytics are aggregated in Postgres — only small summaries leave the
 * database, so a 250k-event workspace costs the same to render as a tiny one.
 *
 * Retention definition for imported events (stated in the UI): a user counts
 * as retained at Dn if they were active again within that offset's bracket
 * (D1 = days 1–6, D7 = 7–13, D14 = 14–29, D30 = 30–59, D60 = 60–89, D90 = 90–119
 * after their first event), and is only counted for offsets whose whole bracket
 * falls inside the data (right-censoring) — recent users never drag rates down.
 */
import { unstable_cache } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { productBacklogItems, productExperimentStats } from '@/db/schema'
import type { CohortRow } from '@/core/cohort'
import { resolveDataSource, type DataSource } from '@/server/workspace'
import { buildAdoption, buildFunnel, buildRetention, buildSegments, type AdoptionRow, type SegmentSummary } from './analytics'
import { getExperiments } from './experiments'
import { DEMO_INITIATIVES } from './prioritization'
import { USER_COUNT } from './generator'
import { experimentsFromStats, funnelFromCounts, initiativesFromBacklog, type PooledRetention, type ProductInsights } from './insights'

export type ProductDataset = ProductInsights & { source: DataSource }

const BRACKETS: [offset: number, end: number][] = [
  [0, 1], [1, 7], [7, 14], [14, 30], [30, 60], [60, 90], [90, 120],
]
const SEGMENT_LABELS = ['Dormant', 'Low', 'Casual', 'Engaged', 'Power']
const MAX_FUNNEL_STEPS = 6

type Row = Record<string, unknown>
const rowsOf = (r: unknown): Row[] => (r as { rows: Row[] }).rows ?? []
const n = (v: unknown) => Number(v ?? 0)

function demoDataset(source: DataSource): ProductDataset {
  const { matrix, pooled } = buildRetention()
  const funnel = buildFunnel()
  return {
    source,
    userCount: USER_COUNT,
    retention: {
      pooled: pooled.map((p) => ({ ...p, eligible: USER_COUNT })),
      matrix,
      definition: 'Active on exactly day N after signup (simulated cohorts).',
    },
    funnel,
    eventNames: [],
    funnelSteps: funnel.steps.map((s) => s.step),
    adoption: buildAdoption(),
    segments: buildSegments(),
    experiments: getExperiments(),
    initiatives: DEMO_INITIATIVES,
    hasEvents: true,
    hasExperiments: true,
    hasBacklog: true,
  }
}

async function eventSummary(ws: string) {
  const db = getDb()
  const brackets = sql.join(BRACKETS.map(([o, e]) => sql`(${o}::int, ${e}::int)`), sql`, `)
  const bracketCase = sql.join(
    BRACKETS.map(([o, e]) => sql`WHEN ev.day - u.first_day < ${e}::int THEN ${o}::int`),
    sql` `,
  )
  const [retRes, adoptRes, segRes] = await Promise.all([
    db.execute(sql`
      WITH ev AS (SELECT user_key, (occurred_at AT TIME ZONE 'UTC')::date AS day FROM product_tracked_events WHERE workspace_id = ${ws}),
      u AS (SELECT user_key, min(day) AS first_day FROM ev GROUP BY user_key),
      lim AS (SELECT max(day) AS last_day FROM ev),
      act AS (SELECT DISTINCT ev.user_key, CASE ${bracketCase} END AS bracket FROM ev JOIN u USING (user_key)),
      offs(o, e) AS (VALUES ${brackets})
      SELECT to_char(u.first_day, 'YYYY-MM') AS cohort, offs.o AS off,
             count(*) FILTER (WHERE u.first_day + (offs.e - 1) <= lim.last_day)::int AS eligible,
             count(a.user_key) FILTER (WHERE u.first_day + (offs.e - 1) <= lim.last_day)::int AS active,
             count(*)::int AS cohort_size
      FROM u CROSS JOIN offs CROSS JOIN lim
      LEFT JOIN act a ON a.user_key = u.user_key AND a.bracket = offs.o
      GROUP BY 1, 2 ORDER BY 1, 2`),
    db.execute(sql`
      WITH fe AS (SELECT user_key, event_name, min(occurred_at) AS t FROM product_tracked_events WHERE workspace_id = ${ws} GROUP BY 1, 2),
      uf AS (SELECT user_key, min(t) AS t0 FROM fe GROUP BY 1)
      SELECT fe.event_name, count(*)::int AS users,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM fe.t - uf.t0)) AS median_offset
      FROM fe JOIN uf USING (user_key)
      GROUP BY 1 ORDER BY users DESC, event_name LIMIT 60`),
    db.execute(sql`
      WITH per AS (
        SELECT user_key, count(DISTINCT (occurred_at AT TIME ZONE 'UTC')::date) AS days, count(DISTINCT event_name) AS evs
        FROM product_tracked_events WHERE workspace_id = ${ws} GROUP BY user_key),
      t AS (SELECT evs, ntile(5) OVER (ORDER BY days + evs, user_key) AS tier FROM per)
      SELECT tier, count(*)::int AS n, avg(evs) AS avg_evs FROM t GROUP BY tier ORDER BY tier`),
  ])
  return { ret: rowsOf(retRes), adopt: rowsOf(adoptRes), seg: rowsOf(segRes) }
}

async function funnelCounts(ws: string, steps: string[]): Promise<number[]> {
  if (steps.length < 2) return []
  // Step k counts users who did event k at or after their (first qualifying) step k-1.
  const ctes = steps.map((step, i) =>
    i === 0
      ? sql`s0 AS (SELECT user_key, min(occurred_at) AS t FROM product_tracked_events WHERE workspace_id = ${ws} AND event_name = ${step} GROUP BY user_key)`
      : sql`${sql.raw(`s${i}`)} AS (SELECT e.user_key, min(e.occurred_at) AS t FROM product_tracked_events e JOIN ${sql.raw(`s${i - 1}`)} p ON p.user_key = e.user_key AND e.occurred_at >= p.t WHERE e.workspace_id = ${ws} AND e.event_name = ${step} GROUP BY e.user_key)`,
  )
  const cols = sql.join(steps.map((_, i) => sql`(SELECT count(*) FROM ${sql.raw(`s${i}`)})::int AS ${sql.raw(`c${i}`)}`), sql`, `)
  const res = await getDb().execute(sql`WITH ${sql.join(ctes, sql`, `)} SELECT ${cols}`)
  const row = rowsOf(res)[0] ?? {}
  return steps.map((_, i) => n(row[`c${i}`]))
}

const workspaceData = (ws: string, requested: string[]) =>
  unstable_cache(
    async () => {
      const db = getDb()
      const [summary, expRows, backlogRows] = await Promise.all([
        eventSummary(ws),
        db
          .select({ experiment: productExperimentStats.experiment, variant: productExperimentStats.variant, users: productExperimentStats.users, conversions: productExperimentStats.conversions, hypothesis: productExperimentStats.hypothesis })
          .from(productExperimentStats)
          .where(eq(productExperimentStats.workspaceId, ws))
          .orderBy(productExperimentStats.experiment, productExperimentStats.variant),
        db
          .select({ name: productBacklogItems.name, description: productBacklogItems.description, reach: productBacklogItems.reach, impact: productBacklogItems.impact, confidence: productBacklogItems.confidence, effort: productBacklogItems.effort, userValue: productBacklogItems.userValue, timeCriticality: productBacklogItems.timeCriticality, riskReduction: productBacklogItems.riskReduction })
          .from(productBacklogItems)
          .where(eq(productBacklogItems.workspaceId, ws))
          .orderBy(productBacklogItems.name),
      ])

      const userCount = summary.seg.reduce((s, r) => s + n(r.n), 0)
      const events = summary.adopt.map((r) => ({ name: String(r.event_name), users: n(r.users), median: n(r.median_offset) }))
      const eventNames = events.map((e) => e.name)
      const valid = requested.filter((s, i) => eventNames.includes(s) && requested.indexOf(s) === i).slice(0, MAX_FUNNEL_STEPS)
      // Default funnel: the five most-used events, ordered by when users typically first do them.
      const funnelSteps = valid.length >= 2 ? valid : events.slice(0, 5).sort((a, b) => a.median - b.median).map((e) => e.name)
      const counts = await funnelCounts(ws, funnelSteps)

      return { summary, expRows, backlogRows, userCount, eventNames, funnelSteps, counts }
    },
    ['product', ws, requested.join('\u001f')],
    { revalidate: 3600, tags: [`ws:${ws}`] },
  )()

function retentionFrom(ret: Row[]): { pooled: PooledRetention[]; matrix: CohortRow[] } {
  const cohorts = new Map<string, CohortRow>()
  const pooledAcc = new Map<number, { eligible: number; active: number }>()
  for (const r of ret) {
    const key = String(r.cohort)
    const off = n(r.off)
    const eligible = n(r.eligible)
    const active = n(r.active)
    const row = cohorts.get(key) ?? { cohortKey: key, size: n(r.cohort_size), cells: [] }
    if (eligible > 0) row.cells.push({ offset: off, count: active, rate: active / eligible })
    cohorts.set(key, row)
    const p = pooledAcc.get(off) ?? { eligible: 0, active: 0 }
    p.eligible += eligible
    p.active += active
    pooledAcc.set(off, p)
  }
  const pooled = BRACKETS.map(([o]) => {
    const p = pooledAcc.get(o) ?? { eligible: 0, active: 0 }
    return { offset: o, eligible: p.eligible, ratePct: p.eligible > 0 ? Math.round((p.active / p.eligible) * 1000) / 10 : null }
  })
  return { pooled, matrix: [...cohorts.values()] }
}

export async function getProductDataset(searchParams: Record<string, string | string[] | undefined> = {}): Promise<ProductDataset> {
  const source = await resolveDataSource('product')
  if (source.kind === 'demo') return demoDataset(source)

  const empty: ProductDataset = {
    source,
    userCount: 0,
    retention: { pooled: [], matrix: [], definition: '' },
    funnel: null,
    eventNames: [],
    funnelSteps: [],
    adoption: [],
    segments: [],
    experiments: [],
    initiatives: [],
    hasEvents: false,
    hasExperiments: false,
    hasBacklog: false,
  }
  if (source.kind === 'empty') return empty

  const raw = searchParams.step
  const requested = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((s) => s.slice(0, 120))
  const d = await workspaceData(source.workspaceId, requested)

  const adoption: AdoptionRow[] = d.summary.adopt.map((r) => {
    const users = n(r.users)
    const name = String(r.event_name)
    return { name, slug: name, category: 'event', isCore: false, users, adoptionPct: d.userCount ? Math.round((users / d.userCount) * 1000) / 10 : 0 }
  })
  const segments: SegmentSummary[] = d.summary.seg
    .map((r) => ({ segment: SEGMENT_LABELS[n(r.tier) - 1] ?? `Tier ${n(r.tier)}`, count: n(r.n), avgFeatures: Math.round(n(r.avg_evs) * 10) / 10 }))
    .reverse()
  const experiments = experimentsFromStats(d.expRows)

  return {
    source,
    userCount: d.userCount,
    retention: {
      ...retentionFrom(d.summary.ret),
      definition: 'Returned within the offset’s bracket after first event (D1 = days 1–6, D7 = 7–13, D30 = 30–59, D90 = 90–119); users are only counted once their whole bracket is inside your data.',
    },
    funnel: d.counts.length >= 2 ? funnelFromCounts(d.funnelSteps, d.counts) : null,
    eventNames: d.eventNames,
    funnelSteps: d.funnelSteps,
    adoption,
    segments,
    experiments,
    initiatives: initiativesFromBacklog(d.backlogRows),
    hasEvents: d.userCount > 0,
    hasExperiments: experiments.length > 0,
    hasBacklog: d.backlogRows.length > 0,
  }
}
