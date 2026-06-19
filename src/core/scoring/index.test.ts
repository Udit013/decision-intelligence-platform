import { describe, it, expect } from 'vitest'
import { scoreAndClassify, classify, type ScoreConfig } from './index'

interface Market {
  name: string
  opportunity: number // higher better
  risk: number // lower better
}

const config: ScoreConfig<Market> = {
  criteria: [
    { key: 'opportunity', weight: 0.6, direction: 'higher', value: (m) => m.opportunity, range: [0, 100] },
    { key: 'risk', weight: 0.4, direction: 'lower', value: (m) => m.risk, range: [0, 100] },
  ],
  buckets: [
    { label: 'Expand', min: 70 },
    { label: 'Investigate', min: 50 },
    { label: 'Monitor', min: 30 },
    { label: 'Avoid', min: 0 },
  ],
}

describe('scoreAndClassify', () => {
  it('ranks higher-opportunity / lower-risk first', () => {
    const items: Market[] = [
      { name: 'A', opportunity: 90, risk: 20 },
      { name: 'B', opportunity: 50, risk: 60 },
      { name: 'C', opportunity: 30, risk: 90 },
    ]
    const out = scoreAndClassify(items, config)
    expect(out[0].item.name).toBe('A')
    expect(out[2].item.name).toBe('C')
    expect(out[0].rank).toBe(1)
  })

  it('computes the expected composite with fixed ranges', () => {
    // opp=100 → norm 1.0 *0.6; risk=0 → lower-better norm 1.0 *0.4 ⇒ 100
    const out = scoreAndClassify([{ name: 'ideal', opportunity: 100, risk: 0 }], config)
    expect(out[0].score).toBeCloseTo(100, 5)
    expect(out[0].bucket).toBe('Expand')
  })

  it('assigns buckets by threshold', () => {
    const items: Market[] = [
      { name: 'top', opportunity: 95, risk: 10 }, // ~89 → Expand
      { name: 'mid', opportunity: 55, risk: 50 }, // ~53 → Investigate
      { name: 'low', opportunity: 20, risk: 80 }, // ~16 → Avoid
    ]
    const out = scoreAndClassify(items, config)
    const byName = Object.fromEntries(out.map((o) => [o.item.name, o.bucket]))
    expect(byName.top).toBe('Expand')
    expect(byName.mid).toBe('Investigate')
    expect(byName.low).toBe('Avoid')
  })

  it('contributions sum to the score', () => {
    const out = scoreAndClassify([{ name: 'x', opportunity: 70, risk: 40 }], config)
    const sum = out[0].contributions.reduce((s, c) => s + c.weighted, 0)
    expect(sum).toBeCloseTo(out[0].score, 4)
  })

  it('constant criterion is treated as neutral (0.5)', () => {
    // Without a fixed range, identical values across the set → norm 0.5.
    const cfg: ScoreConfig<{ v: number }> = {
      criteria: [{ key: 'v', weight: 1, direction: 'higher', value: (i) => i.v }],
    }
    const out = scoreAndClassify([{ v: 5 }, { v: 5 }], cfg)
    expect(out[0].score).toBeCloseTo(50, 5)
  })

  it('classify helper picks the highest matching tier', () => {
    const buckets = config.buckets!
    expect(classify(72, buckets)).toBe('Expand')
    expect(classify(50, buckets)).toBe('Investigate')
    expect(classify(0, buckets)).toBe('Avoid')
  })

  it('returns empty for empty input', () => {
    expect(scoreAndClassify([], config)).toEqual([])
  })
})
