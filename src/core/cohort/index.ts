/**
 * Generic cohort retention matrix.
 *
 * Promoted from productlab's retention cohorts (which lived in raw SQL). Here it's
 * a pure aggregator over normalized activity rows, so any domain can build a
 * retention/repeat matrix in TypeScript: product user retention (D1–D90), or
 * operations customer repeat-purchase by month, etc. The domain decides what a
 * "period offset" means (days, weeks, months) and supplies the rows.
 */

export interface CohortEntry {
  entityId: string | number
  /** Cohort label, e.g. signup month "2023-01". */
  cohortKey: string
  /** Periods elapsed since the cohort's start period (0 = the cohort period itself). */
  periodOffset: number
}

export interface RetentionCell {
  offset: number
  count: number
  /** Retained fraction of the cohort (0–1). */
  rate: number
}

export interface CohortRow {
  cohortKey: string
  size: number
  cells: RetentionCell[]
}

/**
 * Build a retention matrix from activity rows.
 * @param entries  one row per (entity active in a period within a cohort). Duplicates are de-duped.
 * @param offsets  the period offsets to report (default: 0..max observed).
 */
export function buildRetentionMatrix(entries: CohortEntry[], offsets?: number[]): CohortRow[] {
  if (!entries.length) return []

  // cohortKey → offset → set of entityIds
  const byCohort = new Map<string, Map<number, Set<string | number>>>()
  let maxOffset = 0
  for (const e of entries) {
    if (e.periodOffset < 0) continue
    maxOffset = Math.max(maxOffset, e.periodOffset)
    let offMap = byCohort.get(e.cohortKey)
    if (!offMap) byCohort.set(e.cohortKey, (offMap = new Map()))
    let set = offMap.get(e.periodOffset)
    if (!set) offMap.set(e.periodOffset, (set = new Set()))
    set.add(e.entityId)
  }

  const reportOffsets = offsets ?? Array.from({ length: maxOffset + 1 }, (_, i) => i)

  const rows: CohortRow[] = []
  for (const [cohortKey, offMap] of byCohort) {
    // Cohort size = entities present at offset 0; fall back to union if absent.
    const base = offMap.get(0)
    const size = base
      ? base.size
      : new Set(Array.from(offMap.values()).flatMap((s) => Array.from(s))).size
    const cells: RetentionCell[] = reportOffsets.map((offset) => {
      const count = offMap.get(offset)?.size ?? 0
      return { offset, count, rate: size > 0 ? count / size : 0 }
    })
    rows.push({ cohortKey, size, cells })
  }

  // Sort cohorts chronologically by key (string compare works for ISO-ish keys).
  rows.sort((a, b) => (a.cohortKey < b.cohortKey ? -1 : a.cohortKey > b.cohortKey ? 1 : 0))
  return rows
}
