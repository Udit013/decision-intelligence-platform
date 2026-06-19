/**
 * Adversarial demonstration that the validation harness produces BAD numbers on
 * hard inputs — proof it measures, not rubber-stamps. Run: `npx tsx scripts/harness-demo.ts`
 */
import { forecast } from '../src/core/forecast/index'
import { walkForwardBacktest, calibration, type Forecaster } from '../src/core/validation/index'

// Deterministic PRNG (mulberry32) so the "bad" numbers are reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const dates = (n: number) => {
  const out: string[] = []
  const d = new Date('2023-01-01')
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}
const coreForecaster: Forecaster = (train, h) => {
  const r = forecast(train, dates(train.length), 'day', h)
  return r.series.filter((p) => p.actual === null).map((p) => p.forecast ?? 0)
}

console.log('\n══════ 1. FORECAST ON UNPREDICTABLE (white-noise) SERIES ══════')
const rand = rng(42)
const noise = Array.from({ length: 80 }, () => 100 + (rand() - 0.5) * 160) // mean ~100, ±80
const fNoise = forecast(noise, dates(80), 'day', 14)
console.log(`model chosen           : ${fNoise.model}`)
console.log(`IN-SAMPLE  mape (fit)  : ${fNoise.metrics.mape}%`)
console.log(`OUT-OF-SAMPLE backtest : ${fNoise.backtest?.mape}%`)
console.log(`  note: MAPE is unstable on noisy/near-zero actuals (asymmetric, small denominators),`)
console.log(`        so don't read in-sample vs OOS MAPE ordering literally. R² below is the honest signal.`)

const wf = walkForwardBacktest(noise, coreForecaster, { minTrain: 40, horizon: 7, step: 7 })
console.log(`walk-forward (5 folds) : MAPE ${wf.metrics.mape.toFixed(1)}%  RMSE ${wf.metrics.rmse.toFixed(1)}  R² ${wf.metrics.r2.toFixed(3)}`)
console.log(`  -> R² <= 0 means the model is no better than predicting the mean. The harness caught it.`)

console.log('\n══════ 2. FORECAST ACROSS A STRUCTURAL BREAK (trend then crash) ══════')
const broken = [
  ...Array.from({ length: 40 }, (_, i) => 100 + 5 * i), // rises 100 -> 295
  ...Array.from({ length: 20 }, () => 60), // crashes and stays flat
]
const wfBreak = walkForwardBacktest(broken, coreForecaster, { minTrain: 30, horizon: 5, step: 3 })
console.log(`walk-forward MAPE      : ${wfBreak.metrics.mape.toFixed(1)}%   (trend models extrapolate straight into the crash)`)

console.log('\n══════ 3. CONFIDENCE CALIBRATION ══════')
const overconfident = [
  ...Array.from({ length: 18 }, () => ({ confidence: 0.95, correct: true })),
  ...Array.from({ length: 82 }, () => ({ confidence: 0.95, correct: false })), // claims 95%, right 18%
]
const cBad = calibration(overconfident)
console.log(`OVERCONFIDENT model    : claimed 95%, observed ${(cBad.bins[0].observedRate * 100).toFixed(0)}%  ->  ECE ${cBad.ece.toFixed(3)}  Brier ${cBad.brier.toFixed(3)}  (FAIL)`)

const honest = [
  ...Array.from({ length: 70 }, () => ({ confidence: 0.7, correct: true })),
  ...Array.from({ length: 30 }, () => ({ confidence: 0.7, correct: false })), // claims 70%, right 70%
]
const cGood = calibration(honest)
console.log(`WELL-CALIBRATED model  : claimed 70%, observed ${(cGood.bins[0].observedRate * 100).toFixed(0)}%  ->  ECE ${cGood.ece.toFixed(3)}  Brier ${cGood.brier.toFixed(3)}  (PASS)`)
console.log('')
