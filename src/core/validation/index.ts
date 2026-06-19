/**
 * Validation harness — the genuinely NEW capability, present in none of the three
 * source repos.
 *
 * Two jobs:
 *  1. Forecast accuracy via WALK-FORWARD backtesting: repeatedly train on a prefix
 *     of the series and score the next `horizon` points out-of-sample, across many
 *     origins. This is stricter than a single holdout and yields an honest MAPE/
 *     RMSE/MAE/R² we can print in the UI and README (worse-but-true numbers
 *     included).
 *  2. Confidence CALIBRATION: when a recommendation says "70% confidence", was it
 *     right ~70% of the time? Reports a reliability table, Brier score, and
 *     Expected Calibration Error (ECE).
 */
import { mean, clamp } from '@/core/stats'

/* ── Point error metrics ─────────────────────────────────────────────────────── */

export interface ErrorMetrics {
  mae: number
  rmse: number
  /** percent */
  mape: number
  r2: number
  n: number
}

export function errorMetrics(actual: number[], pred: number[]): ErrorMetrics {
  const n = Math.min(actual.length, pred.length)
  if (!n) return { mae: 0, rmse: 0, mape: 0, r2: 0, n: 0 }
  let absSum = 0
  let sqSum = 0
  const m = mean(actual.slice(0, n))
  let ssRes = 0
  let ssTot = 0
  const apeVals: number[] = []
  for (let i = 0; i < n; i++) {
    const err = actual[i] - pred[i]
    absSum += Math.abs(err)
    sqSum += err * err
    ssRes += err * err
    ssTot += (actual[i] - m) ** 2
    if (actual[i] !== 0) apeVals.push(Math.abs(err / actual[i]))
  }
  return {
    mae: absSum / n,
    rmse: Math.sqrt(sqSum / n),
    mape: apeVals.length ? mean(apeVals) * 100 : 0,
    r2: ssTot === 0 ? 0 : clamp(1 - ssRes / ssTot, -1, 1),
    n,
  }
}

/* ── Walk-forward forecast backtest ──────────────────────────────────────────── */

/** A forecaster: given training values, return predictions for the next `horizon` steps. */
export type Forecaster = (trainValues: number[], horizon: number) => number[]

export interface WalkForwardOptions {
  /** Minimum training length before the first origin. */
  minTrain?: number
  /** Steps predicted ahead at each origin. */
  horizon?: number
  /** Advance the origin by this many steps between folds. */
  step?: number
}

export interface BacktestResult {
  origins: number
  horizon: number
  /** Aggregate out-of-sample metrics across all folds, pooled. */
  metrics: ErrorMetrics
  /** Per-origin metrics for diagnostics / plotting. */
  perOrigin: { trainEnd: number; metrics: ErrorMetrics }[]
}

/**
 * Expanding-window walk-forward backtest. At each origin t (t >= minTrain), fit on
 * values[0..t) and compare the next `horizon` predictions to the actuals.
 */
export function walkForwardBacktest(
  values: number[],
  forecaster: Forecaster,
  opts: WalkForwardOptions = {},
): BacktestResult {
  const n = values.length
  const horizon = opts.horizon ?? 1
  const minTrain = opts.minTrain ?? Math.max(4, Math.floor(n * 0.5))
  const step = opts.step ?? horizon

  const pooledActual: number[] = []
  const pooledPred: number[] = []
  const perOrigin: BacktestResult['perOrigin'] = []
  let origins = 0

  for (let t = minTrain; t + 1 <= n; t += step) {
    const train = values.slice(0, t)
    const k = Math.min(horizon, n - t)
    if (k <= 0) break
    const preds = forecaster(train, k).slice(0, k)
    const actuals = values.slice(t, t + k)
    if (preds.length < actuals.length) break
    pooledActual.push(...actuals)
    pooledPred.push(...preds)
    perOrigin.push({ trainEnd: t, metrics: errorMetrics(actuals, preds) })
    origins++
  }

  return {
    origins,
    horizon,
    metrics: errorMetrics(pooledActual, pooledPred),
    perOrigin,
  }
}

/* ── Confidence calibration ──────────────────────────────────────────────────── */

export interface CalibrationSample {
  /** Predicted probability / confidence in [0,1]. */
  confidence: number
  /** Whether the prediction turned out correct. */
  correct: boolean
}

export interface CalibrationBin {
  lo: number
  hi: number
  count: number
  meanConfidence: number
  observedRate: number
}

export interface CalibrationResult {
  bins: CalibrationBin[]
  /** Mean squared error of confidence vs outcome (lower is better, 0..1). */
  brier: number
  /** Expected Calibration Error: weighted |confidence − observed| (lower is better). */
  ece: number
  n: number
}

/** Assess how well confidence scores match observed outcome frequencies. */
export function calibration(samples: CalibrationSample[], nBins = 10): CalibrationResult {
  const n = samples.length
  if (!n) return { bins: [], brier: 0, ece: 0, n: 0 }

  const bins: CalibrationBin[] = Array.from({ length: nBins }, (_, i) => ({
    lo: i / nBins,
    hi: (i + 1) / nBins,
    count: 0,
    meanConfidence: 0,
    observedRate: 0,
  }))
  const confSum = new Array(nBins).fill(0)
  const correctSum = new Array(nBins).fill(0)

  let brier = 0
  for (const s of samples) {
    const c = clamp(s.confidence, 0, 1)
    const outcome = s.correct ? 1 : 0
    brier += (c - outcome) ** 2
    let idx = Math.floor(c * nBins)
    if (idx >= nBins) idx = nBins - 1
    bins[idx].count++
    confSum[idx] += c
    correctSum[idx] += outcome
  }
  brier /= n

  let ece = 0
  for (let i = 0; i < nBins; i++) {
    if (bins[i].count === 0) continue
    bins[i].meanConfidence = confSum[i] / bins[i].count
    bins[i].observedRate = correctSum[i] / bins[i].count
    ece += (bins[i].count / n) * Math.abs(bins[i].meanConfidence - bins[i].observedRate)
  }

  return { bins: bins.filter((b) => b.count > 0), brier, ece, n }
}
