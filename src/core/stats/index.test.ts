import { describe, it, expect } from 'vitest'
import {
  mean,
  std,
  percentile,
  median,
  linearRegression,
  normalCdf,
  normalQuantile,
  twoTailedPValue,
  zForConfidence,
  calculateABTest,
  cagr,
  summarize,
  meanConfidenceInterval,
} from './index'

describe('descriptive stats', () => {
  it('mean / std / median', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(std([2, 4, 4, 4, 5, 5, 7, 9], false)).toBeCloseTo(2, 5) // textbook population std = 2
  })

  it('percentile interpolates', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([10, 20, 30], 0)).toBe(10)
    expect(percentile([10, 20, 30], 100)).toBe(30)
  })

  it('summarize handles empty', () => {
    expect(summarize([])).toMatchObject({ mean: 0, median: 0, max: 0 })
  })

  it('cagr per-step compound rate', () => {
    // 100 → 200 over 4 steps: (2)^(1/4) - 1
    expect(cagr([100, 0, 0, 0, 200])).toBeCloseTo(Math.pow(2, 1 / 4) - 1, 6)
  })
})

describe('regression', () => {
  it('recovers a known line y = 3x + 2 exactly', () => {
    const fit = linearRegression([2, 5, 8, 11, 14])
    expect(fit.slope).toBeCloseTo(3, 9)
    expect(fit.intercept).toBeCloseTo(2, 9)
    expect(fit.r2).toBeCloseTo(1, 9)
    expect(fit.predict(5)).toBeCloseTo(17, 9)
  })
})

describe('normal distribution', () => {
  it('normalCdf known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3)
  })

  it('normalQuantile is inverse of cdf', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 2)
    expect(normalQuantile(0.5)).toBeCloseTo(0, 2)
  })

  it('zForConfidence standard levels', () => {
    expect(zForConfidence(0.95)).toBeCloseTo(1.96, 3)
    expect(zForConfidence(0.9)).toBeCloseTo(1.6449, 3)
  })

  it('twoTailedPValue', () => {
    expect(twoTailedPValue(1.96)).toBeCloseTo(0.05, 2)
    expect(twoTailedPValue(0)).toBeCloseTo(1, 4)
  })
})

describe('A/B test', () => {
  it('detects a clear winner as significant', () => {
    const r = calculateABTest(100, 1000, 160, 1000)
    expect(r.controlRate).toBeCloseTo(0.1, 6)
    expect(r.treatmentRate).toBeCloseTo(0.16, 6)
    expect(r.liftPercent).toBeCloseTo(60, 4)
    expect(r.significant).toBe(true)
    expect(r.verdict).toBe('winner')
    expect(r.pValue).toBeLessThan(0.05)
  })

  it('a tiny difference is inconclusive', () => {
    const r = calculateABTest(100, 1000, 102, 1000)
    expect(r.significant).toBe(false)
    expect(r.verdict).toBe('inconclusive')
  })

  it('flags a significant loser', () => {
    const r = calculateABTest(200, 1000, 120, 1000)
    expect(r.verdict).toBe('loser')
    expect(r.significant).toBe(true)
  })

  it('required sample size is positive and finite', () => {
    const r = calculateABTest(100, 1000, 110, 1000)
    expect(r.requiredSamplePerArm).toBeGreaterThan(0)
    expect(Number.isFinite(r.requiredSamplePerArm)).toBe(true)
  })
})

describe('confidence interval', () => {
  it('mean CI brackets the mean', () => {
    const [lo, hi] = meanConfidenceInterval([10, 12, 14, 16, 18], 0.95)
    expect(lo).toBeLessThan(14)
    expect(hi).toBeGreaterThan(14)
  })
})
