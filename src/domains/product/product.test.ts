import { describe, it, expect } from 'vitest'
import { buildRetention, buildFunnel, buildSegments } from './analytics'
import { rankInitiatives, wsjfAvailable } from './prioritization'
import { experimentsFromStats, funnelFromCounts } from './insights'
import { getExperiments } from './experiments'
import { RETENTION_OFFSETS, USER_COUNT } from './generator'

describe('retention — measured via core/cohort', () => {
  const { matrix, pooled } = buildRetention()

  it('D0 is 100% and retention decreases monotonically', () => {
    expect(pooled.find((p) => p.offset === 0)!.ratePct).toBe(100)
    for (let i = 1; i < pooled.length; i++) {
      expect(pooled[i].ratePct).toBeLessThanOrEqual(pooled[i - 1].ratePct)
    }
  })

  it('reports the configured D1–D90 offsets', () => {
    expect(pooled.map((p) => p.offset)).toEqual(RETENTION_OFFSETS)
  })

  it('builds a cohort matrix (one row per signup month)', () => {
    expect(matrix.length).toBeGreaterThan(0)
    const totalSize = matrix.reduce((s, r) => s + r.size, 0)
    expect(totalSize).toBe(USER_COUNT)
  })
})

describe('funnel — measured, monotonically narrowing', () => {
  it('each step has <= users than the previous', () => {
    const { steps } = buildFunnel()
    for (let i = 1; i < steps.length; i++) expect(steps[i].users).toBeLessThanOrEqual(steps[i - 1].users)
    expect(steps[0].conversionFromTop).toBe(100)
  })
})

describe('prioritization — RICE/ICE/WSJF via core/scoreAndClassify', () => {
  it('ranks and tiers; priority is the normalized 0–100 core score', () => {
    const ranked = rankInitiatives('rice')
    expect(ranked[0].rank).toBe(1)
    expect(ranked[0].priority).toBeGreaterThanOrEqual(ranked[ranked.length - 1].priority)
    expect(ranked[0].priority).toBeLessThanOrEqual(100)
    expect(['Now', 'Next', 'Later', 'Backlog']).toContain(ranked[0].tier)
  })

  it('switching the model can change the order (different criterion accessor)', () => {
    const rice = rankInitiatives('rice').map((i) => i.name)
    const wsjf = rankInitiatives('wsjf').map((i) => i.name)
    expect(rice).not.toEqual(wsjf)
  })
})

describe('experiments — A/B via core/stats', () => {
  it('produces a mix of verdicts (not all wins)', () => {
    const verdicts = new Set(getExperiments().map((e) => e.stats.verdict))
    expect(verdicts.size).toBeGreaterThan(1)
    expect(getExperiments().some((e) => e.stats.verdict === 'winner')).toBe(true)
  })
})

describe('segments — core/segmentation quintiles', () => {
  it('produces five tiers covering all users', () => {
    const segs = buildSegments()
    expect(segs).toHaveLength(5)
    expect(segs.reduce((s, x) => s + x.count, 0)).toBe(USER_COUNT)
  })
})

describe('imported product data', () => {
  it('pairs each treatment with the control and runs the shared z-test', () => {
    const res = experimentsFromStats([
      { experiment: 'Checkout', variant: 'B', users: 1000, conversions: 150, hypothesis: null },
      { experiment: 'Checkout', variant: 'control', users: 1000, conversions: 100, hypothesis: 'Shorter form' },
      { experiment: 'Solo', variant: 'control', users: 10, conversions: 1, hypothesis: null },
    ])
    expect(res).toHaveLength(1) // single-variant experiments can't be tested
    expect(res[0].controlConversions).toBe(100)
    expect(res[0].stats.verdict).toBe('winner')
  })

  it('names comparisons when an experiment has several treatments', () => {
    const res = experimentsFromStats([
      { experiment: 'Price', variant: 'control', users: 500, conversions: 50, hypothesis: null },
      { experiment: 'Price', variant: 'B', users: 500, conversions: 55, hypothesis: null },
      { experiment: 'Price', variant: 'C', users: 500, conversions: 40, hypothesis: null },
    ])
    expect(res.map((r) => r.name)).toEqual(['Price · B vs control', 'Price · C vs control'])
  })

  it('computes funnel conversion from ordered step counts', () => {
    const f = funnelFromCounts(['visit', 'signup', 'pay'], [200, 50, 10])
    expect(f.steps[1].conversionFromPrev).toBe(25)
    expect(f.steps[2].conversionFromTop).toBe(5)
    expect(f.overall).toBe(5)
  })

  it('disables WSJF unless every initiative has its inputs', () => {
    const base = { name: 'x', description: '', reach: 10, impact: 1, confidence: 0.5, effort: 2, userValue: 3, timeCriticality: 2, riskReduction: 1 }
    expect(wsjfAvailable([base])).toBe(true)
    expect(wsjfAvailable([base, { ...base, name: 'y', riskReduction: null }])).toBe(false)
    expect(rankInitiatives('wsjf', [base, { ...base, name: 'y', riskReduction: null }])[1].wsjf).toBeNull()
  })
})
