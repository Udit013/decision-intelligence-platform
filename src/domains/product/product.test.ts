import { describe, it, expect } from 'vitest'
import { buildRetention, buildFunnel, buildSegments } from './analytics'
import { rankInitiatives } from './prioritization'
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
