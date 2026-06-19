/**
 * Generic segmentation via quantile scoring.
 *
 * Promoted from retail's RFM/CLV customer engine, but generalized: the core idea
 * — rank a population into N quantile bins on one or more dimensions — is reusable
 * (customer RFM, product velocity tiers, market size bands). Domains supply the
 * accessors and an optional segment-labeling rule.
 */

export type QuantileDirection = 'higher' | 'lower'

/**
 * Assign each value a quantile score in 1..bins.
 * direction 'higher' → larger values score higher (frequency, monetary).
 * direction 'lower'  → smaller values score higher (recency in days).
 * Ties are resolved by sorted position so the distribution across bins is even.
 */
export function assignQuantiles(
  values: number[],
  bins = 5,
  direction: QuantileDirection = 'higher',
): number[] {
  const n = values.length
  if (n === 0) return []
  if (n === 1) return [Math.ceil(bins / 2)]

  // Rank by ascending value (index → rank position).
  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
  const rank = new Array(n)
  order.forEach((o, pos) => (rank[o.i] = pos))

  return values.map((_, i) => {
    const q = rank[i] / (n - 1) // 0..1
    let score = Math.min(bins, Math.floor(q * bins) + 1)
    if (direction === 'lower') score = bins + 1 - score
    return score
  })
}

export interface RfmInput {
  /** Days since last activity (lower = more recent = better). */
  recency: number
  /** Count of events/orders (higher = better). */
  frequency: number
  /** Total monetary value (higher = better). */
  monetary: number
}

export interface RfmScore {
  r: number
  f: number
  m: number
  /** Combined R+F+M (3..3*bins). */
  rfm: number
  segment: string
}

/**
 * Default RFM segment labels from R and FM scores (1..5 scale assumed).
 * Mirrors the common RFM grid (Champions, Loyal, At Risk, Hibernating, …).
 * Override via the `segmentOf` option of `computeRfm`.
 */
export function defaultRfmSegment(r: number, f: number, m: number): string {
  const fm = (f + m) / 2
  if (r >= 4 && fm >= 4) return 'Champions'
  if (r >= 3 && fm >= 3) return 'Loyal'
  if (r >= 4 && fm <= 2) return 'New'
  if (r >= 3 && fm <= 2) return 'Promising'
  if (r <= 2 && fm >= 4) return 'At Risk'
  if (r <= 2 && fm >= 3) return 'Needs Attention'
  if (r <= 1 && fm <= 2) return 'Hibernating'
  return 'Monitor'
}

/** Compute RFM scores + segment labels for a population. */
export function computeRfm<T extends RfmInput>(
  rows: T[],
  bins = 5,
  segmentOf: (r: number, f: number, m: number) => string = defaultRfmSegment,
): (T & RfmScore)[] {
  if (!rows.length) return []
  const rScores = assignQuantiles(rows.map((x) => x.recency), bins, 'lower')
  const fScores = assignQuantiles(rows.map((x) => x.frequency), bins, 'higher')
  const mScores = assignQuantiles(rows.map((x) => x.monetary), bins, 'higher')

  return rows.map((row, i) => {
    const r = rScores[i]
    const f = fScores[i]
    const m = mScores[i]
    return { ...row, r, f, m, rfm: r + f + m, segment: segmentOf(r, f, m) }
  })
}
