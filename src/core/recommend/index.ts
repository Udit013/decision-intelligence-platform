/**
 * Generic recommendation / decision synthesizer.
 *
 * ⭐ The second centerpiece of the merge. Each domain emits domain-specific
 * Signals (a forecast trend, a churn risk, an inventory shortfall, a market
 * opportunity); this module turns any bag of Signals into a single ranked list of
 * Recommendations with a transparent priority = impact × confidence.
 *
 * Generalized from retail's `buildDecisions()` (which hand-coded the same
 * priority-by-impact×confidence logic per decision) and mirrors the shape of
 * geostrategy's expansion decisions and productlab's opportunity ranking.
 */

export interface SignalMetric {
  label: string
  value: string
}

export interface Signal {
  id: string
  /** Domain-defined grouping label (e.g. "Growth", "Risk", "Inventory"). */
  category: string
  title: string
  recommendation: string
  /** Plain-language statement of the expected outcome. */
  expectedResult: string
  /** Calibrated 0–1 confidence (feeds the validation harness later). */
  confidence: number
  /** Magnitude of what's at stake, in domain units (e.g. dollars). Drives priority. */
  impact: number
  reasoning: string
  metrics?: SignalMetric[]
  /** Optional supporting evidence references. */
  evidence?: string[]
}

export interface Recommendation extends Signal {
  /** Raw priority score (default impact × confidence). */
  priorityScore: number
  /** 1-based rank after sorting (1 = highest priority). */
  priority: number
}

export interface SynthesizeOptions {
  /** Custom priority scorer; default is |impact| × confidence. */
  score?: (s: Signal) => number
  /** Drop signals below this confidence. */
  minConfidence?: number
  /** Drop signals whose absolute impact is below this. */
  minImpact?: number
  /** Cap the number of returned recommendations. */
  limit?: number
}

const defaultScore = (s: Signal) => Math.abs(s.impact) * s.confidence

/** Synthesize ranked recommendations from a bag of domain signals. */
export function synthesize(signals: Signal[], opts: SynthesizeOptions = {}): Recommendation[] {
  const { score = defaultScore, minConfidence = 0, minImpact = 0, limit } = opts

  const ranked = signals
    .filter((s) => s.confidence >= minConfidence && Math.abs(s.impact) >= minImpact)
    .map((s) => ({ ...s, priorityScore: score(s), priority: 0 }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((r, i) => ({ ...r, priority: i + 1 }))

  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked
}
