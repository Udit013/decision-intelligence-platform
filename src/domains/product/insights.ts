/**
 * Product insights — one shape for every Product page, whether it comes from
 * the synthetic sample or a visitor's imported events, experiments and backlog.
 * Pure helpers only; the SQL lives in ./dataset.
 */
import { calculateABTest } from '@/core/stats'
import type { CohortRow } from '@/core/cohort'
import type { AdoptionRow, FunnelStep, SegmentSummary } from './analytics'
import type { ExperimentResult } from './experiments'
import type { InitiativeInput } from './prioritization'

export interface PooledRetention {
  offset: number
  /** null when no user had been observed long enough for this offset */
  ratePct: number | null
  /** users old enough to be measured at this offset */
  eligible: number
}

export interface ProductInsights {
  userCount: number
  retention: { pooled: PooledRetention[]; matrix: CohortRow[]; definition: string }
  funnel: { steps: FunnelStep[]; overall: number } | null
  /** Event names the visitor can build a funnel from (most-used first). */
  eventNames: string[]
  funnelSteps: string[]
  adoption: AdoptionRow[]
  segments: SegmentSummary[]
  experiments: ExperimentResult[]
  initiatives: InitiativeInput[]
  hasEvents: boolean
  hasExperiments: boolean
  hasBacklog: boolean
}

const pct1 = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

/** Funnel conversion from ordered step counts. */
export function funnelFromCounts(steps: string[], counts: number[]): { steps: FunnelStep[]; overall: number } {
  const top = counts[0] ?? 0
  return {
    steps: steps.map((step, i) => ({
      step,
      users: counts[i] ?? 0,
      conversionFromPrev: i === 0 ? 100 : pct1(counts[i] ?? 0, counts[i - 1] ?? 0),
      conversionFromTop: pct1(counts[i] ?? 0, top),
    })),
    overall: pct1(counts[counts.length - 1] ?? 0, top),
  }
}

export interface ExperimentStatRow {
  experiment: string
  variant: string
  users: number
  conversions: number
  hypothesis: string | null
}

const CONTROL = /^(control|baseline|original|a|ctrl|holdout)$/i

/**
 * Pairs every treatment variant with its experiment's control (named
 * control/baseline/original/A; otherwise the variant with most users) and runs
 * the shared two-proportion z-test.
 */
export function experimentsFromStats(rows: ExperimentStatRow[]): ExperimentResult[] {
  const byExp = new Map<string, ExperimentStatRow[]>()
  for (const r of rows) byExp.set(r.experiment, [...(byExp.get(r.experiment) ?? []), r])
  const out: ExperimentResult[] = []
  for (const [name, variants] of byExp) {
    if (variants.length < 2) continue
    const control = variants.find((v) => CONTROL.test(v.variant.trim())) ?? [...variants].sort((a, b) => b.users - a.users)[0]
    const treatments = variants.filter((v) => v !== control)
    for (const t of treatments) {
      out.push({
        name: treatments.length > 1 ? `${name} · ${t.variant} vs ${control.variant}` : name,
        hypothesis: t.hypothesis ?? control.hypothesis ?? `${t.variant} vs ${control.variant}`,
        controlConversions: control.conversions,
        controlSamples: control.users,
        treatmentConversions: t.conversions,
        treatmentSamples: t.users,
        stats: calculateABTest(control.conversions, control.users, t.conversions, t.users),
      })
    }
  }
  return out
}

export interface BacklogRow {
  name: string
  description: string | null
  reach: number
  impact: number
  confidence: number
  effort: number
  userValue: number | null
  timeCriticality: number | null
  riskReduction: number | null
}

export function initiativesFromBacklog(rows: BacklogRow[]): InitiativeInput[] {
  return rows.map((r) => ({ ...r, description: r.description ?? '' }))
}
