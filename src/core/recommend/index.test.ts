import { describe, it, expect } from 'vitest'
import { synthesize, type Signal } from './index'

const sig = (id: string, impact: number, confidence: number): Signal => ({
  id,
  category: 'Test',
  title: id,
  recommendation: 'do it',
  expectedResult: 'good things',
  confidence,
  impact,
  reasoning: 'because',
})

describe('synthesize', () => {
  it('ranks by impact × confidence', () => {
    const out = synthesize([
      sig('a', 100, 0.5), // 50
      sig('b', 200, 0.9), // 180
      sig('c', 300, 0.2), // 60
    ])
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(out[0].priority).toBe(1)
    expect(out[0].priorityScore).toBeCloseTo(180, 5)
  })

  it('uses absolute impact so large declines rank high', () => {
    const out = synthesize([sig('up', 50, 0.9), sig('down', -500, 0.9)])
    expect(out[0].id).toBe('down')
  })

  it('filters by minConfidence and minImpact', () => {
    const out = synthesize([sig('keep', 100, 0.8), sig('lowconf', 100, 0.1), sig('lowimpact', 1, 0.9)], {
      minConfidence: 0.5,
      minImpact: 10,
    })
    expect(out.map((r) => r.id)).toEqual(['keep'])
  })

  it('respects a custom scorer and limit', () => {
    const out = synthesize([sig('a', 1, 1), sig('b', 1, 1), sig('c', 1, 1)], {
      score: (s) => (s.id === 'c' ? 999 : 1),
      limit: 1,
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('c')
  })

  it('returns empty for no signals', () => {
    expect(synthesize([])).toEqual([])
  })
})
