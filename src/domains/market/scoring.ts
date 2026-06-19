/**
 * Market scoring — built ON TOP of the /core primitives, not reimplemented.
 *
 * ✅ Requirement #3: the Expand / Investigate / Monitor / Avoid classifier is
 * `core/scoreAndClassify()` with a market-specific ScoreConfig + buckets. The old
 * geostrategy code hand-coded this as a chain of if/else thresholds; that logic now
 * lives once in /core. Entry-strategy ranking ALSO uses scoreAndClassify.
 *
 * ⚠️ MODELED: every weight, bucket threshold, and the ROI/cost formulas below are
 * editorial estimates over synthetic data — labeled "modeled" in the UI.
 */
import { scoreAndClassify, type ScoreConfig, type Bucket } from '@/core/scoring'
import type { Market, CompetitiveData, EntryStrategyOption, RiskProfile, MarketDecision, Recommendation, EntryStrategy } from './types'

/** MODELED weights for the expansion composite (sum need not be 1). */
export const MARKET_DECISION_WEIGHTS = { opportunity: 0.4, easeOfEntry: 0.3, risk: 0.2, gdpGrowth: 0.1 }

/** MODELED bucket thresholds on the 0–100 composite. */
export const MARKET_BUCKETS: Bucket[] = [
  { label: 'Expand', min: 62 },
  { label: 'Investigate', min: 48 },
  { label: 'Monitor', min: 34 },
  { label: 'Avoid', min: 0 },
]

const decisionConfig: ScoreConfig<Market> = {
  criteria: [
    { key: 'opportunity', weight: MARKET_DECISION_WEIGHTS.opportunity, direction: 'higher', value: (m) => m.opportunityScore, range: [0, 100] },
    { key: 'easeOfEntry', weight: MARKET_DECISION_WEIGHTS.easeOfEntry, direction: 'higher', value: (m) => m.easeOfEntry, range: [0, 100] },
    { key: 'risk', weight: MARKET_DECISION_WEIGHTS.risk, direction: 'lower', value: (m) => m.riskScore, range: [0, 100] },
    { key: 'gdpGrowth', weight: MARKET_DECISION_WEIGHTS.gdpGrowth, direction: 'higher', value: (m) => m.gdpGrowth, range: [-3, 13] },
  ],
  buckets: MARKET_BUCKETS,
}

function reasonsFor(m: Market, comp: CompetitiveData): string[] {
  const r: string[] = []
  if (m.gdpGrowth > 5) r.push(`strong GDP growth at ${m.gdpGrowth}%`)
  if (m.opportunityScore > 65) r.push('high opportunity score')
  if (comp.marketSaturation < 35) r.push('low competitive saturation')
  if (m.riskScore < 35) r.push('low risk profile')
  if (m.purchasingPowerIndex > 70) r.push('strong purchasing power')
  if (m.internetPenetration > 85) r.push('high digital adoption')
  return r
}

/** Ranked + classified expansion decisions — straight from core/scoreAndClassify. */
export function generateMarketDecisions(markets: Market[], competitive: CompetitiveData[]): MarketDecision[] {
  const compMap = new Map(competitive.map((c) => [c.marketId, c]))
  const scored = scoreAndClassify(markets, decisionConfig)

  return scored.map((s) => {
    const m = s.item
    const comp = compMap.get(m.id)!
    const reasons = reasonsFor(m, comp)
    const roi = Math.max(0.5, Math.min(8, Math.round((m.opportunityScore / 25 + m.easeOfEntry / 50 + m.gdpGrowth / 5 - m.riskScore / 100) * 10) / 10))
    return {
      marketId: m.id,
      marketName: m.name,
      recommendation: (s.bucket ?? 'Monitor') as Recommendation,
      score: s.score,
      rank: s.rank,
      opportunityScore: m.opportunityScore,
      riskScore: m.riskScore,
      easeOfEntry: m.easeOfEntry,
      gdpGrowth: m.gdpGrowth,
      marketSize: m.gdp,
      expectedRoi: roi,
      investmentRequired: Math.round(150 + (comp.entryDifficultyScore / 100) * 850),
      reasoning: reasons.length ? `${m.name} offers ${reasons.slice(0, 3).join(', ')}.` : `${m.name} presents a mixed profile requiring careful analysis.`,
      keyDrivers: reasons.slice(0, 3),
      contributions: s.contributions.map((c) => ({ key: c.key, weighted: Math.round(c.weighted * 10) / 10 })),
    }
  })
}

/** 5-dimension risk model (ported). MODELED. */
export function computeRiskProfile(market: Market, competitive: CompetitiveData): RiskProfile {
  const economic = Math.round((100 - market.currencyStability) * 0.4 + Math.min(100, market.inflationRate * 1.5) * 0.35 + (market.gdpGrowth < 0 ? 40 : 0) * 0.25)
  const competitive_ = Math.round(competitive.competitivePressureScore * 0.5 + competitive.entryDifficultyScore * 0.5)
  const regulatory = Math.round((100 - market.easeOfDoingBusiness) * 0.5 + market.taxRate * 0.8 * 0.3 + (market.currencyStability < 50 ? 20 : 0) * 0.2)
  const operational = Math.round((100 - market.urbanization) * 0.3 + (100 - market.internetPenetration) * 0.4 + (100 - market.easeOfDoingBusiness) * 0.3)
  const marketRisk = Math.round((100 - market.purchasingPowerIndex) * 0.4 + Math.max(0, (3 - market.gdpGrowth) * 10) * 0.3 + (100 - market.mobileAdoption) * 0.3)
  const overall = Math.round(economic * 0.25 + competitive_ * 0.2 + regulatory * 0.2 + operational * 0.2 + marketRisk * 0.15)
  const mitigations: string[] = []
  if (economic > 50) mitigations.push('Hedge currency exposure through local pricing')
  if (competitive_ > 60) mitigations.push('Enter through partnership to reduce competition risk')
  if (regulatory > 50) mitigations.push('Engage local legal counsel for regulatory navigation')
  if (operational > 60) mitigations.push('Build digital-first operations to minimize logistics dependency')
  if (marketRisk > 50) mitigations.push('Target urban premium segment to maximize purchasing power')
  return { overall: Math.min(100, overall), economic: Math.min(100, economic), competitive: Math.min(100, competitive_), regulatory: Math.min(100, regulatory), operational: Math.min(100, operational), market: Math.min(100, marketRisk), mitigations }
}

const ENTRY_DEFS: Omit<EntryStrategyOption, 'risk' | 'cost' | 'timeToMarket' | 'expectedRoi' | 'rank'>[] = [
  { strategy: 'direct', name: 'Direct Market Entry', resourceRequirements: ['Local entity', 'Hiring', 'Compliance', 'Office'], description: 'Wholly-owned subsidiary. Full control, highest investment.' },
  { strategy: 'partnership', name: 'Strategic Partnership', resourceRequirements: ['Partner ID', 'JV agreement', 'Integration', 'Shared marketing'], description: 'Partner with a local player. Faster entry, shared upside.' },
  { strategy: 'franchise', name: 'Franchise Model', resourceRequirements: ['Franchise docs', 'Training', 'Brand standards', 'Support'], description: 'License your model to franchisees. Low capital, scalable.' },
  { strategy: 'distributor', name: 'Distributor Network', resourceRequirements: ['Distributor agreements', 'Localization', 'Support'], description: 'Sell through local distributors. Minimal investment, limited control.' },
  { strategy: 'acquisition', name: 'Strategic Acquisition', resourceRequirements: ['M&A diligence', 'Integration', 'Legal', 'PMI'], description: 'Acquire a local business. Instant share, high complexity.' },
]

/** Entry strategies ranked via core/scoreAndClassify (ROI↑, risk↓, cost↓). */
export function generateEntryStrategies(market: Market, competitive: CompetitiveData): EntryStrategyOption[] {
  const risk = computeRiskProfile(market, competitive)
  const raw = ENTRY_DEFS.map((d) => {
    const base = (() => {
      switch (d.strategy) {
        case 'direct': return { cost: 500 + (100 - market.easeOfDoingBusiness) * 8, risk: risk.overall, ttm: 6 + Math.round((100 - market.easeOfDoingBusiness) / 10), roi: Math.max(0.8, 4.5 - risk.overall / 50) }
        case 'partnership': return { cost: 120 + competitive.entryDifficultyScore * 2, risk: Math.round(risk.overall * 0.65), ttm: 3 + Math.round(competitive.entryDifficultyScore / 20), roi: Math.max(0.6, 3.2 - risk.overall / 70) }
        case 'franchise': return { cost: 80 + market.population * 0.5, risk: Math.round(risk.overall * 0.55), ttm: 4 + Math.round(market.population / 200), roi: Math.max(0.5, 2.8 - risk.overall / 80) }
        case 'distributor': return { cost: 50 + competitive.competitorCount * 3, risk: Math.round(risk.overall * 0.45), ttm: 2, roi: Math.max(0.4, 2.1 - risk.overall / 90) }
        case 'acquisition': return { cost: 1200 + (market.gdp / 10) * 5, risk: Math.round(risk.overall * 0.75), ttm: 8 + Math.round(competitive.entryDifficultyScore / 15), roi: Math.max(1.2, 5.5 - risk.overall / 40) }
      }
    })()
    return { ...d, cost: Math.round(base.cost), risk: base.risk, timeToMarket: base.ttm, expectedRoi: Math.round(base.roi * 10) / 10, rank: 0 } as EntryStrategyOption
  })

  const ranked = scoreAndClassify(raw, {
    criteria: [
      { key: 'roi', weight: 0.5, direction: 'higher', value: (s) => s.expectedRoi },
      { key: 'risk', weight: 0.3, direction: 'lower', value: (s) => s.risk },
      { key: 'cost', weight: 0.2, direction: 'lower', value: (s) => s.cost },
    ],
  })
  return ranked.map((r) => ({ ...r.item, rank: r.rank }))
}

export interface ScenarioParams {
  budget: number
  teamSize: number
  pricingStrategy: 'premium' | 'mid_market' | 'value'
  marketingSpend: number
  strategy: EntryStrategy
}

export interface ScenarioResult {
  expectedRevenue: number
  expectedProfit: number
  marketShareCapture: number
  breakEvenMonths: number
  roiProjection: number
  projections: Array<{ month: number; revenue: number; profit: number; cumulative: number }>
}

/** 24-month entry scenario simulation (ported, MODELED). */
export function simulateExpansion(market: Market, competitive: CompetitiveData, params: ScenarioParams): ScenarioResult {
  // Guard against degenerate inputs (budget/team = 0) so we never emit NaN/Infinity
  // from a division — the UI shows a clean zeroed result instead of throwing.
  const budget = Math.max(1, params.budget)
  const teamSize = Math.max(0, params.teamSize)
  params = { ...params, budget, teamSize }

  const pricingMult = { premium: 1.8, mid_market: 1.0, value: 0.6 }[params.pricingStrategy]
  const teamImpact = Math.min(2.0, 1 + params.teamSize / 50)
  const marketingImpact = Math.min(1.8, 1 + params.marketingSpend / params.budget)
  const baseRevenue = market.gdp * 0.001 * 1000 * (market.opportunityScore / 100)
  const competitionDiscount = 1 - competitive.marketSaturation / 200
  const expectedRevenue = Math.round(baseRevenue * pricingMult * teamImpact * marketingImpact * competitionDiscount * (params.budget / 500))
  const marginRate = { premium: 0.45, mid_market: 0.28, value: 0.15 }[params.pricingStrategy]
  const opexRatio = 0.3 + (params.teamSize / 100) * 0.2
  const expectedProfit = Math.round(expectedRevenue * marginRate - expectedRevenue * opexRatio - params.budget * 0.3)
  const totalAddressable = market.gdp * 0.05 * 1000
  const marketShareCapture = Math.min(25, Math.max(0.1, Math.round((expectedRevenue / totalAddressable) * 1000) / 10))
  const monthlyProfit = expectedProfit / 12
  const monthlyBurn = params.budget / 18
  const breakEvenMonths = monthlyProfit > 0 ? Math.max(3, Math.round(params.budget / monthlyProfit)) : Math.min(48, 36 + Math.round(market.riskScore / 10))
  const roiProjection = Math.max(-1, Math.min(15, Math.round(((expectedRevenue * 3 - params.budget) / params.budget) * 10) / 10))

  const raw = Array.from({ length: 24 }, (_, i) => {
    const month = i + 1
    const ramp = Math.min(1, month / 6)
    const rev = Math.round((expectedRevenue / 12) * ramp * (1 + (market.gdpGrowth / 100) * (month / 12)))
    const profit = Math.round(rev * marginRate - rev * opexRatio - (month < 6 ? monthlyBurn : monthlyBurn * 0.4))
    return { month, revenue: Math.max(0, rev), profit }
  })
  const projections = raw.reduce<ScenarioResult['projections']>((acc, item, i) => {
    const prev = acc[i - 1]?.cumulative ?? -params.budget
    acc.push({ ...item, cumulative: prev + item.profit })
    return acc
  }, [])

  return { expectedRevenue, expectedProfit, marketShareCapture, breakEvenMonths, roiProjection, projections }
}
