/**
 * Generic multi-criteria scoring + bucket classification.
 *
 * ⭐ One of the two centerpiece primitives of the merge. Every "rank items by a
 * composite score, then sort them into named tiers" pattern in the source repos
 * collapses into this one configurable function:
 *   - geostrategy's Expand / Investigate / Monitor / Avoid market classifier
 *   - geostrategy's entry-strategy ranking (roi·30 − risk·0.3 − cost/100)
 *   - productlab's RICE / ICE / WSJF initiative ranking
 *
 * A domain supplies criteria (key, weight, value accessor, and whether higher or
 * lower is better) plus optional bucket thresholds. The engine min-max normalizes
 * each criterion across the set, computes a 0–100 weighted composite, ranks, and
 * classifies — and returns per-criterion contributions so the "why" is auditable.
 */

export type Direction = 'higher' | 'lower'

export interface Criterion<T> {
  key: string
  /** Relative weight (need not sum to 1; normalized internally). */
  weight: number
  /** Whether a higher raw value is better ('higher') or worse ('lower'). */
  direction: Direction
  /** Extract the raw numeric value from an item. */
  value: (item: T) => number
  /**
   * Optional fixed normalization range [min, max]. When omitted, the engine
   * min-max normalizes across the provided set. Use a fixed range when scores
   * must be comparable across different sets/time.
   */
  range?: [number, number]
}

export interface Bucket {
  label: string
  /** Inclusive lower bound on the 0–100 composite. Highest matching bucket wins. */
  min: number
}

export interface ScoreConfig<T> {
  criteria: Criterion<T>[]
  /** Optional classification tiers; evaluated highest-min first. */
  buckets?: Bucket[]
}

export interface Contribution {
  key: string
  raw: number
  /** 0–1 after direction + normalization */
  normalized: number
  /** contribution to the final 0–100 score */
  weighted: number
}

export interface ScoredItem<T> {
  item: T
  /** 0–100 composite. */
  score: number
  rank: number
  bucket: string | null
  contributions: Contribution[]
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/** Classify a single 0–100 score into the highest bucket whose `min` it meets. */
export function classify(score: number, buckets: Bucket[]): string | null {
  const sorted = [...buckets].sort((a, b) => b.min - a.min)
  for (const b of sorted) if (score >= b.min) return b.label
  return null
}

export function scoreAndClassify<T>(items: T[], config: ScoreConfig<T>): ScoredItem<T>[] {
  const { criteria, buckets } = config
  if (!items.length) return []
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1

  // Resolve a [min,max] range per criterion (fixed or derived from the set).
  const ranges = criteria.map((c) => {
    if (c.range) return c.range
    const vals = items.map((it) => c.value(it))
    return [Math.min(...vals), Math.max(...vals)] as [number, number]
  })

  const scored = items.map((item) => {
    const contributions: Contribution[] = criteria.map((c, i) => {
      const raw = c.value(item)
      const [lo, hi] = ranges[i]
      // Neutral 0.5 when the criterion is constant across the set.
      let norm = hi === lo ? 0.5 : clamp01((raw - lo) / (hi - lo))
      if (c.direction === 'lower') norm = 1 - norm
      const weighted = (norm * c.weight) / totalWeight
      return { key: c.key, raw, normalized: norm, weighted: weighted * 100 }
    })
    const score = contributions.reduce((s, c) => s + c.weighted, 0)
    return {
      item,
      score: Math.round(score * 10) / 10,
      rank: 0,
      bucket: buckets ? classify(score, buckets) : null,
      contributions,
    }
  })

  scored.sort((a, b) => b.score - a.score)
  scored.forEach((s, i) => (s.rank = i + 1))
  return scored
}
