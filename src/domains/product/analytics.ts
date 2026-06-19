/**
 * Product analytics computed from the in-memory synthetic dataset.
 * Retention goes through the shared core/cohort primitive (the old productlab
 * version was raw SQL); segmentation uses core/segmentation. Funnels & adoption
 * are simple counts over the generated users.
 */
import { buildRetentionMatrix, type CohortEntry, type CohortRow } from '@/core/cohort'
import { assignQuantiles } from '@/core/segmentation'
import { generateUsers, FEATURES, RETENTION_OFFSETS, type ProductUser } from './generator'

/* ── Retention (core/cohort) ─────────────────────────────────────────────────── */

export interface RetentionResult {
  matrix: CohortRow[]
  /** Pooled retention across all cohorts at each offset — the MEASURED D1–D90. */
  pooled: { offset: number; ratePct: number }[]
}

export function buildRetention(): RetentionResult {
  const users = generateUsers()
  const entries: CohortEntry[] = []
  for (const u of users) for (const off of u.activeOffsets) entries.push({ entityId: u.id, cohortKey: u.cohortKey, periodOffset: off })

  const matrix = buildRetentionMatrix(entries, RETENTION_OFFSETS)

  // Pool across cohorts: total active at offset / total cohort base.
  const pooled = RETENTION_OFFSETS.map((offset) => {
    let active = 0
    let base = 0
    for (const row of matrix) {
      base += row.size
      active += row.cells.find((c) => c.offset === offset)?.count ?? 0
    }
    return { offset, ratePct: base > 0 ? Math.round((active / base) * 1000) / 10 : 0 }
  })
  return { matrix, pooled }
}

/* ── Funnel ──────────────────────────────────────────────────────────────────── */

export interface FunnelStep {
  step: string
  users: number
  conversionFromPrev: number
  conversionFromTop: number
}

export function buildFunnel(): { steps: FunnelStep[]; overall: number } {
  const users = generateUsers()
  const total = users.length
  const counts = [
    { step: 'Signed up', n: total },
    { step: 'Started onboarding', n: users.filter((u) => u.reachedOnboarding).length },
    { step: 'Activated', n: users.filter((u) => u.activated).length },
    { step: 'Used a feature', n: users.filter((u) => u.usedFeature).length },
    { step: 'Purchased', n: users.filter((u) => u.purchased).length },
  ]
  const steps = counts.map((c, i) => ({
    step: c.step,
    users: c.n,
    conversionFromPrev: i === 0 ? 100 : counts[i - 1].n > 0 ? Math.round((c.n / counts[i - 1].n) * 1000) / 10 : 0,
    conversionFromTop: total > 0 ? Math.round((c.n / total) * 1000) / 10 : 0,
  }))
  return { steps, overall: total > 0 ? Math.round((counts[counts.length - 1].n / total) * 1000) / 10 : 0 }
}

/* ── Feature adoption ────────────────────────────────────────────────────────── */

export interface AdoptionRow {
  name: string
  slug: string
  category: string
  isCore: boolean
  users: number
  adoptionPct: number
}

export function buildAdoption(): AdoptionRow[] {
  const users = generateUsers()
  const total = users.length
  const counts = new Map<string, number>()
  for (const u of users) for (const f of u.featuresUsed) counts.set(f, (counts.get(f) ?? 0) + 1)
  return FEATURES.map((f) => {
    const n = counts.get(f.slug) ?? 0
    return { name: f.name, slug: f.slug, category: f.category, isCore: f.isCore, users: n, adoptionPct: total > 0 ? Math.round((n / total) * 1000) / 10 : 0 }
  }).sort((a, b) => b.adoptionPct - a.adoptionPct)
}

/* ── Engagement segments (core/segmentation) ─────────────────────────────────── */

export interface SegmentSummary {
  segment: string
  count: number
  avgFeatures: number
}

/** Tier users into engagement quintiles via core/segmentation's quantile scoring. */
export function buildSegments(): SegmentSummary[] {
  const users = generateUsers()
  const engagement = users.map((u) => u.activeOffsets.length + u.featuresUsed.length)
  const tiers = assignQuantiles(engagement, 5, 'higher')
  const LABELS = ['Dormant', 'Low', 'Casual', 'Engaged', 'Power'] // tier 1..5
  const by = new Map<string, { count: number; features: number }>()
  users.forEach((u: ProductUser, i) => {
    const label = LABELS[tiers[i] - 1]
    const s = by.get(label) ?? { count: 0, features: 0 }
    s.count++
    s.features += u.featuresUsed.length
    by.set(label, s)
  })
  return LABELS.map((segment) => {
    const s = by.get(segment) ?? { count: 0, features: 0 }
    return { segment, count: s.count, avgFeatures: s.count > 0 ? Math.round((s.features / s.count) * 10) / 10 : 0 }
  }).reverse()
}
