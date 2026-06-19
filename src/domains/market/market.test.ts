import { describe, it, expect } from 'vitest'
import { generateMarkets, generateCompetitiveData, MARKET_COUNT } from './generator'
import { generateMarketDecisions, generateEntryStrategies, simulateExpansion, MARKET_BUCKETS } from './scoring'

describe('market generator — provenance', () => {
  it('reports the REAL distinct count, not the old "121"', () => {
    const markets = generateMarkets()
    expect(markets.length).toBe(MARKET_COUNT)
    expect(MARKET_COUNT).toBe(120) // 121 source rows minus the duplicate Pakistan
    expect(MARKET_COUNT).not.toBe(121)
  })

  it('has no duplicate codes or names', () => {
    const markets = generateMarkets()
    expect(new Set(markets.map((m) => m.code)).size).toBe(markets.length)
    expect(new Set(markets.map((m) => m.name)).size).toBe(markets.length)
    expect(markets.filter((m) => m.name === 'Pakistan')).toHaveLength(1)
  })
})

describe('expansion decisions — uses core/scoreAndClassify', () => {
  const markets = generateMarkets()
  const competitive = generateCompetitiveData()
  const decisions = generateMarketDecisions(markets, competitive)

  it('classifies into the configured buckets only', () => {
    const labels = new Set(MARKET_BUCKETS.map((b) => b.label))
    for (const d of decisions) expect(labels.has(d.recommendation)).toBe(true)
  })

  it('is ranked by score descending with sequential ranks', () => {
    expect(decisions[0].rank).toBe(1)
    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i].score).toBeLessThanOrEqual(decisions[i - 1].score)
      expect(decisions[i].rank).toBe(i + 1)
    }
  })

  it('emits per-criterion contributions from the core primitive (the auditable "why")', () => {
    const keys = decisions[0].contributions.map((c) => c.key).sort()
    expect(keys).toEqual(['easeOfEntry', 'gdpGrowth', 'opportunity', 'risk'])
    // contributions sum to the composite score (core scoreAndClassify invariant)
    const sum = decisions[0].contributions.reduce((s, c) => s + c.weighted, 0)
    expect(sum).toBeCloseTo(decisions[0].score, 0)
  })

  it('ranks a strong market above a weak one', () => {
    const strong = decisions.find((d) => d.opportunityScore > 70 && d.riskScore < 40)
    const weak = decisions.find((d) => d.riskScore > 75)
    if (strong && weak) expect(strong.rank).toBeLessThan(weak.rank)
  })
})

describe('scenario simulator — degrades gracefully on degenerate input', () => {
  const market = generateMarkets()[0]
  const comp = generateCompetitiveData()[0]

  it('budget=0 and teamSize=0 produce finite numbers, not NaN/Infinity', () => {
    const r = simulateExpansion(market, comp, { budget: 0, teamSize: 0, pricingStrategy: 'mid_market', marketingSpend: 0, strategy: 'direct' })
    for (const v of [r.expectedRevenue, r.expectedProfit, r.marketShareCapture, r.breakEvenMonths, r.roiProjection]) {
      expect(Number.isFinite(v)).toBe(true)
    }
    for (const p of r.projections) {
      expect(Number.isFinite(p.revenue)).toBe(true)
      expect(Number.isFinite(p.profit)).toBe(true)
      expect(Number.isFinite(p.cumulative)).toBe(true)
    }
  })
})

describe('entry strategies — ranked via core primitive', () => {
  it('returns 5 strategies with sequential ranks', () => {
    const markets = generateMarkets()
    const competitive = generateCompetitiveData()
    const strategies = generateEntryStrategies(markets[0], competitive[0])
    expect(strategies).toHaveLength(5)
    expect(strategies.map((s) => s.rank).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })
})
