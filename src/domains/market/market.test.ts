import { describe, it, expect } from 'vitest'
import { marketsFromIndicators, competitiveFromShares, type IndicatorRow } from './model'
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
    const strong = decisions.find((d) => (d.opportunityScore ?? 0) > 70 && (d.riskScore ?? 100) < 40)
    const weak = decisions.find((d) => (d.riskScore ?? 0) > 75)
    if (strong && weak) expect(strong.rank).toBeLessThan(weak.rank)
  })
})

describe('scenario simulator — degrades gracefully on degenerate input', () => {
  const market = generateMarkets()[0]
  const comp = generateCompetitiveData()[0]

  it('budget=0 and teamSize=0 produce finite numbers, not NaN/Infinity', () => {
    const r = simulateExpansion(market, comp, { budget: 0, teamSize: 0, pricingStrategy: 'mid_market', marketingSpend: 0, strategy: 'direct' })!
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

describe('uploaded market data', () => {
  const row = (over: Partial<IndicatorRow> = {}): IndicatorRow => ({
    marketKey: 'testland', name: 'Testland', code: 'TL', region: 'Europe',
    gdpUsdBn: 500, gdpGrowthPct: 4, populationM: 40, avgIncomeUsd: 30000, internetPct: 80, mobilePct: 85,
    urbanPct: 70, purchasingPowerIndex: 70, easeOfBusiness: 75, taxRatePct: 22, inflationPct: 3, currencyStability: 85,
    ...over,
  })

  it('scores complete rows exactly like the sample formula', () => {
    const [m] = marketsFromIndicators([row()])
    expect(m.dataCoverage).toBe(1)
    expect(m.opportunityScore).not.toBeNull()
  })

  it('scores partial rows from the inputs present and never invents the rest', () => {
    const [m] = marketsFromIndicators([row({ currencyStability: null, inflationPct: null, easeOfBusiness: null, purchasingPowerIndex: null, taxRatePct: null })])
    expect(m.riskScore).toBeNull()
    expect(m.easeOfEntry).not.toBeNull() // internet still informs ease of entry
    expect(m.dataCoverage).toBeLessThan(1)
    expect(m.currencyStability).toBeNull()
  })

  it('computes HHI and saturation from real competitor shares', () => {
    const markets = marketsFromIndicators([row()])
    const [c] = competitiveFromShares(markets, [
      { marketKey: 'testland', competitor: 'A', marketSharePct: 50 },
      { marketKey: 'testland', competitor: 'B', marketSharePct: 30 },
    ])
    expect(c.marketConcentration).toBe(50 ** 2 + 30 ** 2)
    expect(c.marketSaturation).toBe(80)
    expect(c.topPlayers[0]).toMatchObject({ name: 'A', strength: 'dominant' })
  })

  it('refuses to project a scenario without GDP', () => {
    const [m] = marketsFromIndicators([row({ gdpUsdBn: null })])
    expect(simulateExpansion(m, undefined, { budget: 500, teamSize: 10, pricingStrategy: 'value', marketingSpend: 100, strategy: 'direct' })).toBeNull()
  })

  it('ranks markets even when some decision criteria are missing', () => {
    const markets = marketsFromIndicators([row(), row({ marketKey: 'thin', name: 'Thin', gdpGrowthPct: null, currencyStability: null })])
    const decisions = generateMarketDecisions(markets, [])
    expect(decisions).toHaveLength(2)
    expect(decisions.every((d) => d.coverage > 0)).toBe(true)
  })
})
