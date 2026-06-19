import { describe, it, expect } from 'vitest'
import { errorMetrics, walkForwardBacktest, calibration } from './index'

describe('errorMetrics', () => {
  it('zero error for perfect prediction', () => {
    const m = errorMetrics([1, 2, 3], [1, 2, 3])
    expect(m.mae).toBe(0)
    expect(m.rmse).toBe(0)
    expect(m.mape).toBe(0)
    expect(m.r2).toBe(1)
  })

  it('computes MAE/RMSE/MAPE', () => {
    const m = errorMetrics([100, 200], [110, 180])
    expect(m.mae).toBeCloseTo(15, 5) // (10+20)/2
    expect(m.rmse).toBeCloseTo(Math.sqrt((100 + 400) / 2), 5)
    expect(m.mape).toBeCloseTo(((0.1 + 0.1) / 2) * 100, 5)
  })
})

describe('walkForwardBacktest', () => {
  it('a perfect forecaster yields ~zero error across folds', () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + 2 * i)
    // Perfect-knowledge forecaster: continue the exact arithmetic progression.
    const forecaster = (train: number[], h: number) => {
      const slope = 2
      const last = train[train.length - 1]
      return Array.from({ length: h }, (_, i) => last + slope * (i + 1))
    }
    const res = walkForwardBacktest(values, forecaster, { minTrain: 5, horizon: 3, step: 3 })
    expect(res.origins).toBeGreaterThan(0)
    expect(res.metrics.rmse).toBeCloseTo(0, 6)
    expect(res.metrics.r2).toBeCloseTo(1, 6)
  })

  it('a naive (last-value) forecaster has measurable error on a trend', () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + 2 * i)
    const naive = (train: number[], h: number) =>
      Array.from({ length: h }, () => train[train.length - 1])
    const res = walkForwardBacktest(values, naive, { minTrain: 5, horizon: 2, step: 2 })
    expect(res.metrics.rmse).toBeGreaterThan(0)
  })
})

describe('calibration', () => {
  it('perfectly calibrated samples → low ECE', () => {
    // 100 samples at 0.7 confidence, 70 correct.
    const samples = [
      ...Array.from({ length: 70 }, () => ({ confidence: 0.7, correct: true })),
      ...Array.from({ length: 30 }, () => ({ confidence: 0.7, correct: false })),
    ]
    const res = calibration(samples)
    expect(res.ece).toBeLessThan(0.05)
    expect(res.n).toBe(100)
  })

  it('overconfident samples → high ECE', () => {
    // Claims 0.95 but only 20% correct.
    const samples = [
      ...Array.from({ length: 20 }, () => ({ confidence: 0.95, correct: true })),
      ...Array.from({ length: 80 }, () => ({ confidence: 0.95, correct: false })),
    ]
    const res = calibration(samples)
    expect(res.ece).toBeGreaterThan(0.5)
    expect(res.brier).toBeGreaterThan(0.4)
  })

  it('empty input is safe', () => {
    expect(calibration([])).toMatchObject({ n: 0, ece: 0, brier: 0, bins: [] })
  })
})
