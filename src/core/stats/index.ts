/**
 * Core statistical primitives — domain-agnostic, zero-dependency, runs anywhere
 * (Vercel serverless included).
 *
 * This module MERGES the two divergent implementations from the source repos:
 *  - retail's `lib/intelligence/stats.ts` (descriptive stats, OLS regression,
 *    normal CDF, z-for-confidence)
 *  - productlab's `lib/engines/statistics.ts` (inverse normal, two-tailed p-value,
 *    A/B proportions test, distribution summary)
 * `normalCdf` was implemented twice with different approximations; here there is
 * one canonical version and everything else builds on it.
 */

/* ── Descriptive ─────────────────────────────────────────────────────────────── */

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0
}

export function variance(xs: number[], sample = true): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const ss = sum(xs.map((x) => (x - m) ** 2))
  return ss / (xs.length - (sample ? 1 : 0))
}

export function std(xs: number[], sample = true): number {
  return Math.sqrt(variance(xs, sample))
}

/** Linear-interpolation percentile (p in [0,100]). */
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const rank = (clamp(p, 0, 100) / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (rank - lo) * (sorted[hi] - sorted[lo])
}

export function median(xs: number[]): number {
  return percentile(xs, 50)
}

export function zScores(xs: number[]): number[] {
  const m = mean(xs)
  const s = std(xs)
  if (s === 0) return xs.map(() => 0)
  return xs.map((x) => (x - m) / s)
}

export function coefficientOfVariation(xs: number[]): number {
  const m = mean(xs)
  return m === 0 ? 0 : std(xs) / m
}

/** Compound growth rate per step between first and last positive values. */
export function cagr(xs: number[]): number {
  if (xs.length < 2) return 0
  const first = xs.find((v) => v > 0)
  const last = [...xs].reverse().find((v) => v > 0)
  if (!first || !last || first <= 0) return 0
  return Math.pow(last / first, 1 / (xs.length - 1)) - 1
}

export function movingAverage(xs: number[], window: number): number[] {
  if (window <= 1) return [...xs]
  return xs.map((_, i) => mean(xs.slice(Math.max(0, i - window + 1), i + 1)))
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

export interface StatsSummary {
  mean: number
  median: number
  std: number
  p25: number
  p75: number
  p95: number
  min: number
  max: number
}

export function summarize(xs: number[]): StatsSummary {
  if (!xs.length) return { mean: 0, median: 0, std: 0, p25: 0, p75: 0, p95: 0, min: 0, max: 0 }
  return {
    mean: mean(xs),
    median: median(xs),
    std: std(xs),
    p25: percentile(xs, 25),
    p75: percentile(xs, 75),
    p95: percentile(xs, 95),
    min: Math.min(...xs),
    max: Math.max(...xs),
  }
}

/* ── Regression ──────────────────────────────────────────────────────────────── */

export interface LinearFit {
  slope: number
  intercept: number
  r2: number
  residualStd: number
  predict: (x: number) => number
}

/** Ordinary least-squares regression over (index, value) or explicit x. */
export function linearRegression(ys: number[], xs?: number[]): LinearFit {
  const n = ys.length
  const X = xs ?? ys.map((_, i) => i)
  if (n < 2) {
    const c = ys[0] ?? 0
    return { slope: 0, intercept: c, r2: 0, residualStd: 0, predict: () => c }
  }
  const mx = mean(X)
  const my = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (X[i] - mx) * (ys[i] - my)
    den += (X[i] - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  const predict = (x: number) => slope * x + intercept

  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - predict(X[i])) ** 2
    ssTot += (ys[i] - my) ** 2
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot
  const residualStd = Math.sqrt(ssRes / Math.max(1, n - 2))
  return { slope, intercept, r2, residualStd, predict }
}

/* ── Normal distribution ─────────────────────────────────────────────────────── */

/** Standard-normal CDF (Abramowitz & Stegun 7.1.26). The one canonical version. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/** Inverse standard-normal CDF (Beasley-Springer/Moro style rational approx). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [2.515517, 0.802853, 0.010328]
  const b = [1.432788, 0.189269, 0.001308]
  const t = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)))
  const num = a[0] + t * (a[1] + t * a[2])
  const den = 1 + t * (b[0] + t * (b[1] + t * b[2]))
  return (p < 0.5 ? -1 : 1) * (t - num / den)
}

/** Two-sided p-value for a z statistic. */
export function twoTailedPValue(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)))
}

/** Z multiplier for a two-sided confidence level (e.g. 0.95 → ~1.96). */
export function zForConfidence(confidence: number): number {
  const table: Record<string, number> = {
    '0.8': 1.2816,
    '0.9': 1.6449,
    '0.95': 1.96,
    '0.99': 2.5758,
  }
  return table[String(confidence)] ?? Math.abs(normalQuantile(1 - (1 - confidence) / 2))
}

/* ── A/B testing (two-proportion z-test) ─────────────────────────────────────── */

export interface ABTestResult {
  controlRate: number
  treatmentRate: number
  /** absolute lift (treatment − control) */
  lift: number
  /** relative lift as a percent of control */
  liftPercent: number
  zStat: number
  pValue: number
  significant: boolean
  confidenceLevel: number
  /** CI for the absolute lift */
  confidenceInterval: [number, number]
  verdict: 'winner' | 'loser' | 'inconclusive'
  /** required sample size per arm for the configured minimum detectable effect */
  requiredSamplePerArm: number
}

export function calculateABTest(
  controlConversions: number,
  controlSamples: number,
  treatmentConversions: number,
  treatmentSamples: number,
  opts: { alpha?: number; power?: number; minDetectableEffect?: number } = {},
): ABTestResult {
  const { alpha = 0.05, power = 0.8, minDetectableEffect = 0.05 } = opts
  const controlRate = controlSamples > 0 ? controlConversions / controlSamples : 0
  const treatmentRate = treatmentSamples > 0 ? treatmentConversions / treatmentSamples : 0

  const pooled =
    controlSamples + treatmentSamples > 0
      ? (controlConversions + treatmentConversions) / (controlSamples + treatmentSamples)
      : 0
  const se =
    controlSamples > 0 && treatmentSamples > 0
      ? Math.sqrt(pooled * (1 - pooled) * (1 / controlSamples + 1 / treatmentSamples))
      : 0

  const zStat = se > 0 ? (treatmentRate - controlRate) / se : 0
  const pValue = twoTailedPValue(zStat)
  const significant = pValue < alpha

  const lift = treatmentRate - controlRate
  const liftPercent = controlRate > 0 ? (lift / controlRate) * 100 : 0

  const z = zForConfidence(1 - alpha)
  const margin =
    treatmentSamples > 0 ? z * Math.sqrt((treatmentRate * (1 - treatmentRate)) / treatmentSamples) : 0
  const confidenceInterval: [number, number] = [lift - margin, lift + margin]

  let verdict: ABTestResult['verdict'] = 'inconclusive'
  if (significant) verdict = liftPercent > 0 ? 'winner' : 'loser'

  const zA = zForConfidence(1 - alpha)
  const zB = normalQuantile(power)
  const requiredSamplePerArm = Math.ceil(
    (2 * pooled * (1 - pooled) * (zA + zB) ** 2) / minDetectableEffect ** 2,
  )

  return {
    controlRate,
    treatmentRate,
    lift,
    liftPercent,
    zStat,
    pValue,
    significant,
    confidenceLevel: (1 - alpha) * 100,
    confidenceInterval,
    verdict,
    requiredSamplePerArm: Number.isFinite(requiredSamplePerArm) ? requiredSamplePerArm : 0,
  }
}

/** Confidence interval for a mean using the normal approximation. */
export function meanConfidenceInterval(xs: number[], confidence = 0.95): [number, number] {
  if (xs.length < 2) {
    const v = xs[0] ?? 0
    return [v, v]
  }
  const m = mean(xs)
  const se = std(xs) / Math.sqrt(xs.length)
  const z = zForConfidence(confidence)
  return [m - z * se, m + z * se]
}
