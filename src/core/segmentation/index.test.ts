import { describe, it, expect } from 'vitest'
import { assignQuantiles, computeRfm, defaultRfmSegment } from './index'

describe('assignQuantiles', () => {
  it('spreads a uniform population across all bins', () => {
    const values = Array.from({ length: 10 }, (_, i) => i) // 0..9
    const scores = assignQuantiles(values, 5, 'higher')
    expect(Math.min(...scores)).toBe(1)
    expect(Math.max(...scores)).toBe(5)
    // monotonic non-decreasing with value
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
  })

  it('lower direction inverts (recency: smaller is better)', () => {
    const days = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const scores = assignQuantiles(days, 5, 'lower')
    // smallest recency gets the highest score
    expect(scores[0]).toBe(5)
    expect(scores[scores.length - 1]).toBe(1)
  })

  it('handles tiny populations', () => {
    expect(assignQuantiles([], 5)).toEqual([])
    expect(assignQuantiles([42], 5)).toEqual([3])
  })
})

describe('computeRfm', () => {
  it('scores best customer as Champion, worst as Hibernating', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      recency: 100 - i * 10, // i=9 → most recent
      frequency: i,
      monetary: i * 100,
    }))
    const out = computeRfm(rows, 5)
    const best = out.find((x) => x.id === 9)!
    const worst = out.find((x) => x.id === 0)!
    expect(best.r).toBe(5)
    expect(best.f).toBe(5)
    expect(best.segment).toBe('Champions')
    expect(worst.segment).toBe('Hibernating')
  })

  it('respects a custom segment rule', () => {
    const rows = [{ recency: 1, frequency: 9, monetary: 9 }]
    const out = computeRfm(rows, 5, () => 'CUSTOM')
    expect(out[0].segment).toBe('CUSTOM')
  })

  it('defaultRfmSegment grid', () => {
    expect(defaultRfmSegment(5, 5, 5)).toBe('Champions')
    expect(defaultRfmSegment(1, 5, 5)).toBe('At Risk')
    expect(defaultRfmSegment(5, 1, 1)).toBe('New')
  })
})
