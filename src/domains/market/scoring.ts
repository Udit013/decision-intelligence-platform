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
import { wsum } from './model'

const has = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const opt = (v: number | null | undefined, f: (x: number) => number) => (has(v) ? f(v) : null)

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

function reasonsFor(m: Market, comp: CompetitiveData | undefined): string[] {
  const r: string[] = []
  if (has(m.gdpGrowth) && m.gdpGrowth > 5) r.push(`strong GDP growth at ${m.gdpGrowth}%`)
  if (has(m.opportunityScore) && m.opportunityScore > 65) r.push('high opportunity score')
  if (comp && comp.marketSaturation < 35) r.push('low competitive saturation')
  if (has(m.riskScore) && m.riskScore < 35) r.push('low risk profile')
  if (has(m.purchasingPowerIndex) && m.purchasingPowerIndex > 70) r.push('strong purchasing power')
  if (has(m.internetPenetration) && m.internetPenetration > 85) r.push('high digital adoption')
  return r
}

/** Ranked + classified expansion decisions — straight from core/scoreAndClassify. */
export function generateMarketDecisions(markets: Market[], competitive: CompetitiveData[]): MarketDecision[] {
  const compMap = new Map(competitive.map((c) => [c.marketId, c]))
  const scored = scoreAndClassify(markets, decisionConfig)

  return scored.map((s) => {
    const m = s.item
    const comp = compMap.get(m.id)
    const reasons = reasonsFor(m, comp)
    // MODELED ROI multiple: additive terms; a term with no input contributes nothing.
    const roiRaw = (m.opportunityScore ?? 0) / 25 + (m.easeOfEntry ?? 0) / 50 + (m.gdpGrowth ?? 0) / 5 - (m.riskScore ?? 0) / 100
    const roi = Math.max(0.5, Math.min(8, Math.round(roiRaw * 10) / 10))
    const difficulty = comp?.entryDifficultyScore ?? opt(m.easeOfEntry, (e) => 100 - e)
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
      investmentRequired: has(difficulty) ? Math.round(150 + (difficulty / 100) * 850) : null,
      coverage: s.coverage,
      reasoning: reasons.length ? `${m.name} offers ${reasons.slice(0, 3).join(', ')}.` : `${m.name} presents a mixed profile requiring careful analysis.`,
      keyDrivers: reasons.slice(0, 3),
      contributions: s.contributions.map((c) => ({ key: c.key, weighted: Math.round(c.weighted * 10) / 10 })),
    }
  })
}

/** 5-dimension risk model. MODELED; each dimension uses the inputs it has (null if none). */
export function computeRiskProfile(market: Market, competitive: CompetitiveData | undefined): RiskProfile {
  const g = market.gdpGrowth
  const r = (v: number | null) => (v === null ? null : Math.min(100, Math.round(v)))
  const economic = r(wsum([
    [0.4, opt(market.currencyStability, (x) => 100 - x)],
    [0.35, opt(market.inflationRate, (x) => Math.min(100, x * 1.5))],
    [0.25, opt(g, (x) => (x < 0 ? 40 : 0))],
  ]))
  const competitive_ = competitive ? r(competitive.competitivePressureScore * 0.5 + competitive.entryDifficultyScore * 0.5) : null
  const regulatory = r(wsum([
    [0.5, opt(market.easeOfDoingBusiness, (x) => 100 - x)],
    [0.3, opt(market.taxRate, (x) => x * 0.8)],
    [0.2, opt(market.currencyStability, (x) => (x < 50 ? 20 : 0))],
  ]))
  const operational = r(wsum([
    [0.3, opt(market.urbanization, (x) => 100 - x)],
    [0.4, opt(market.internetPenetration, (x) => 100 - x)],
    [0.3, opt(market.easeOfDoingBusiness, (x) => 100 - x)],
  ]))
  const marketRisk = r(wsum([
    [0.4, opt(market.purchasingPowerIndex, (x) => 100 - x)],
    [0.3, opt(g, (x) => Math.max(0, (3 - x) * 10))],
    [0.3, opt(market.mobileAdoption, (x) => 100 - x)],
  ]))
  const overall = r(wsum([
    [0.25, economic],
    [0.2, competitive_],
    [0.2, regulatory],
    [0.2, operational],
    [0.15, marketRisk],
  ]))
  const mitigations: string[] = []
  if ((economic ?? 0) > 50) mitigations.push('Hedge currency exposure through local pricing')
  if ((competitive_ ?? 0) > 60) mitigations.push('Enter through partnership to reduce competition risk')
  if ((regulatory ?? 0) > 50) mitigations.push('Engage local legal counsel for regulatory navigation')
  if ((operational ?? 0) > 60) mitigations.push('Build digital-first operations to minimize logistics dependency')
  if ((marketRisk ?? 0) > 50) mitigations.push('Target urban premium segment to maximize purchasing power')
  return { overall, economic, competitive: competitive_, regulatory, operational, market: marketRisk, mitigations }
}

const ENTRY_DEFS: Omit<EntryStrategyOption, 'risk' | 'cost' | 'timeToMarket' | 'expectedRoi' | 'rank'>[] = [
  { strategy: 'direct', name: 'Direct Market Entry', resourceRequirements: ['Local entity', 'Hiring', 'Compliance', 'Office'], description: 'Wholly-owned subsidiary. Full control, highest investment.' },
  { strategy: 'partnership', name: 'Strategic Partnership', resourceRequirements: ['Partner ID', 'JV agreement', 'Integration', 'Shared marketing'], description: 'Partner with a local player. Faster entry, shared upside.' },
  { strategy: 'franchise', name: 'Franchise Model', resourceRequirements: ['Franchise docs', 'Training', 'Brand standards', 'Support'], description: 'License your model to franchisees. Low capital, scalable.' },
  { strategy: 'distributor', name: 'Distributor Network', resourceRequirements: ['Distributor agreements', 'Localization', 'Support'], description: 'Sell through local distributors. Minimal investment, limited control.' },
  { strategy: 'acquisition', name: 'Strategic Acquisition', resourceRequirements: ['M&A diligence', 'Integration', 'Legal', 'PMI'], description: 'Acquire a local business. Instant share, high complexity.' },
]

/**
 * Entry strategies ranked via core/scoreAndClassify (ROI↑, risk↓, cost↓). MODELED.
 * Needs an overall risk estimate; cost/time terms whose input is missing are
 * omitted (the base cost/time remains). Returns [] when risk can't be estimated.
 */
export function generateEntryStrategies(market: Market, competitive: CompetitiveData | undefined): EntryStrategyOption[] {
  const risk = computeRiskProfile(market, competitive)
  if (risk.overall === null) return []
  const overall = risk.overall
  const ease = market.easeOfDoingBusiness
  const diff = competitive?.entryDifficultyScore ?? null
  const raw = ENTRY_DEFS.map((d) => {
    const base = (() => {
      switch (d.strategy) {
        case 'direct': return { cost: 500 + (has(ease) ? (100 - ease) * 8 : 0), risk: overall, ttm: 6 + (has(ease) ? Math.round((100 - ease) / 10) : 0), roi: Math.max(0.8, 4.5 - overall / 50) }
        case 'partnership': return { cost: 120 + (diff ?? 0) * 2, risk: Math.round(overall * 0.65), ttm: 3 + Math.round((diff ?? 0) / 20), roi: Math.max(0.6, 3.2 - overall / 70) }
        case 'franchise': return { cost: 80 + (market.population ?? 0) * 0.5, risk: Math.round(overall * 0.55), ttm: 4 + Math.round((market.population ?? 0) / 200), roi: Math.max(0.5, 2.8 - overall / 80) }
        case 'distributor': return { cost: 50 + (competitive?.competitorCount ?? 0) * 3, risk: Math.round(overall * 0.45), ttm: 2, roi: Math.max(0.4, 2.1 - overall / 90) }
        case 'acquisition': return { cost: 1200 + ((market.gdp ?? 0) / 10) * 5, risk: Math.round(overall * 0.75), ttm: 8 + Math.round((diff ?? 0) / 15), roi: Math.max(1.2, 5.5 - overall / 40) }
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

/**
 * 24-month entry scenario simulation (MODELED). Revenue scales with GDP and the
 * opportunity score, so both are required — returns null without them rather
 * than projecting from a guess. Without competitor data no saturation discount
 * is applied.
 */
export function simulateExpansion(market: Market, competitive: CompetitiveData | undefined, params: ScenarioParams): ScenarioResult | null {
  if (!has(market.gdp) || !has(market.opportunityScore)) return null
  const gdp = market.gdp
  const opportunity = market.opportunityScore
  // Guard against degenerate inputs (budget/team = 0) so we never emit NaN/Infinity
  // from a division — the UI shows a clean zeroed result instead of throwing.
  const budget = Math.max(1, params.budget)
  const teamSize = Math.max(0, params.teamSize)
  params = { ...params, budget, teamSize }

  const pricingMult = { premium: 1.8, mid_market: 1.0, value: 0.6 }[params.pricingStrategy]
  const teamImpact = Math.min(2.0, 1 + params.teamSize / 50)
  const marketingImpact = Math.min(1.8, 1 + params.marketingSpend / params.budget)
  const baseRevenue = gdp * 0.001 * 1000 * (opportunity / 100)
  const competitionDiscount = competitive ? 1 - competitive.marketSaturation / 200 : 1
  const expectedRevenue = Math.round(baseRevenue * pricingMult * teamImpact * marketingImpact * competitionDiscount * (params.budget / 500))
  const marginRate = { premium: 0.45, mid_market: 0.28, value: 0.15 }[params.pricingStrategy]
  const opexRatio = 0.3 + (params.teamSize / 100) * 0.2
  const expectedProfit = Math.round(expectedRevenue * marginRate - expectedRevenue * opexRatio - params.budget * 0.3)
  const totalAddressable = gdp * 0.05 * 1000
  const marketShareCapture = Math.min(25, Math.max(0.1, Math.round((expectedRevenue / totalAddressable) * 1000) / 10))
  const monthlyProfit = expectedProfit / 12
  const monthlyBurn = params.budget / 18
  const breakEvenMonths = monthlyProfit > 0 ? Math.max(3, Math.round(params.budget / monthlyProfit)) : Math.min(48, 36 + (has(market.riskScore) ? Math.round(market.riskScore / 10) : 0))
  const roiProjection = Math.max(-1, Math.min(15, Math.round(((expectedRevenue * 3 - params.budget) / params.budget) * 10) / 10))

  const raw = Array.from({ length: 24 }, (_, i) => {
    const month = i + 1
    const ramp = Math.min(1, month / 6)
    const rev = Math.round((expectedRevenue / 12) * ramp * (1 + ((market.gdpGrowth ?? 0) / 100) * (month / 12)))
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
