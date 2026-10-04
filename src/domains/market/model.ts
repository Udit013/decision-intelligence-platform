/**
 * Market model — the one place that turns indicators into scores, competition
 * metrics and opportunities. Shared by the synthetic sample and uploaded data.
 *
 * Every modeled formula is a weighted sum of per-indicator terms. `wsum` drops
 * terms whose input is missing and renormalizes the rest, so complete rows give
 * exactly the original formula and partial rows are scored from the evidence
 * they have — never from invented values. Weights are editorial (MODELED).
 */
import type { CompetitiveData, CompetitorEntry, Market, Opportunity } from './types'

export type Term = [weight: number, value: number | null]

/** Weighted mean over the terms that have a value; null if none do. */
export function wsum(terms: Term[]): number | null {
  let w = 0
  let v = 0
  for (const [weight, value] of terms) {
    if (value === null || !Number.isFinite(value)) continue
    w += weight
    v += weight * value
  }
  return w > 0 ? v / w : null
}

/** Share of term weight that had data. */
export function coverage(terms: Term[]): number {
  const total = terms.reduce((s, [w]) => s + w, 0)
  const have = terms.reduce((s, [w, v]) => s + (v === null || !Number.isFinite(v) ? 0 : w), 0)
  return total > 0 ? have / total : 0
}

const opt = (v: number | null, f: (x: number) => number) => (v === null ? null : f(v))
const clampScore = (v: number | null) => (v === null ? null : Math.max(0, Math.min(100, Math.round(v))))

export interface Indicators {
  gdp: number | null
  gdpGrowth: number | null
  population: number | null
  avgIncome: number | null
  internet: number | null
  ppi: number | null
  ease: number | null
  tax: number | null
  inflation: number | null
  currency: number | null
}

export function scoreTerms(c: Indicators) {
  return {
    attractiveness: [
      [0.2, opt(c.avgIncome, (x) => Math.min(100, (x / 100000) * 100))],
      [0.15, c.ppi],
      [0.2, opt(c.gdpGrowth, (g) => Math.min(100, g * 8))],
      [0.15, c.internet],
      [0.15, c.ease],
      [0.15, c.currency],
    ] as Term[],
    opportunity: [
      [0.2, opt(c.population, (p) => Math.min(100, Math.log10(p * 10) * 30))],
      [0.25, opt(c.gdpGrowth, (g) => Math.min(100, g * 9))],
      [0.2, opt(c.internet, (x) => 100 - x)],
      [0.15, c.ppi],
      [0.2, opt(c.gdp, (x) => Math.min(100, x / 100))],
    ] as Term[],
    risk: [
      [0.25, opt(c.currency, (x) => 100 - x)],
      [0.25, opt(c.inflation, (x) => Math.min(100, x * 1.2))],
      [0.2, opt(c.ease, (x) => 100 - x)],
      [0.15, opt(c.ppi, (x) => 100 - x)],
      [0.15, opt(c.tax, (x) => x * 1.5)],
    ] as Term[],
    easeOfEntry: [
      [0.35, c.ease],
      [0.2, c.currency],
      [0.15, c.internet],
      [0.15, opt(c.tax, (x) => 100 - x)],
      [0.15, opt(c.inflation, (x) => 100 - Math.min(100, x * 1.5))],
    ] as Term[],
  }
}

/** MODELED composite scores (0–100, or null when a score has no inputs at all). */
export function scoreIndicators(c: Indicators) {
  const t = scoreTerms(c)
  const opportunity = wsum(t.opportunity)
  const all = [...t.attractiveness, ...t.opportunity, ...t.risk, ...t.easeOfEntry]
  return {
    marketAttractivenessScore: clampScore(wsum(t.attractiveness)),
    opportunityScore: clampScore(opportunity === null ? null : Math.min(99, opportunity * 1.28)),
    riskScore: clampScore(wsum(t.risk)),
    easeOfEntry: clampScore(wsum(t.easeOfEntry)),
    dataCoverage: coverage(all),
  }
}

export function gdpPerCapita(gdp: number | null, pop: number | null): number | null {
  return gdp === null || pop === null || pop <= 0 ? null : Math.round((gdp * 1000) / pop)
}

/** MODELED: share of GDP spent by consumers rises with income. */
export function consumerSpending(gdp: number | null, income: number | null): number | null {
  if (gdp === null || income === null) return null
  return Math.round(gdp * Math.min(0.72, 0.45 + (income / 100000) * 0.27) * 10) / 10
}

/* ── Uploaded indicators → Market ─────────────────────────────────────────── */

export interface IndicatorRow {
  marketKey: string
  name: string
  code: string | null
  region: string | null
  gdpUsdBn: number | null
  gdpGrowthPct: number | null
  populationM: number | null
  avgIncomeUsd: number | null
  internetPct: number | null
  mobilePct: number | null
  urbanPct: number | null
  purchasingPowerIndex: number | null
  easeOfBusiness: number | null
  taxRatePct: number | null
  inflationPct: number | null
  currencyStability: number | null
}

export function marketsFromIndicators(rows: IndicatorRow[]): Market[] {
  return rows.map((r) => ({
    id: r.marketKey,
    name: r.name,
    code: r.code,
    continent: r.region,
    gdp: r.gdpUsdBn,
    gdpGrowth: r.gdpGrowthPct,
    gdpPerCapita: gdpPerCapita(r.gdpUsdBn, r.populationM),
    population: r.populationM,
    internetPenetration: r.internetPct,
    mobileAdoption: r.mobilePct,
    urbanization: r.urbanPct,
    avgIncome: r.avgIncomeUsd,
    purchasingPowerIndex: r.purchasingPowerIndex,
    easeOfDoingBusiness: r.easeOfBusiness,
    taxRate: r.taxRatePct,
    inflationRate: r.inflationPct,
    currencyStability: r.currencyStability,
    consumerSpending: consumerSpending(r.gdpUsdBn, r.avgIncomeUsd),
    ...scoreIndicators({
      gdp: r.gdpUsdBn,
      gdpGrowth: r.gdpGrowthPct,
      population: r.populationM,
      avgIncome: r.avgIncomeUsd,
      internet: r.internetPct,
      ppi: r.purchasingPowerIndex,
      ease: r.easeOfBusiness,
      tax: r.taxRatePct,
      inflation: r.inflationPct,
      currency: r.currencyStability,
    }),
  }))
}

/* ── Uploaded competitor shares → competition metrics ─────────────────────── */

export interface CompetitorRow {
  marketKey: string
  competitor: string
  marketSharePct: number
}

function strengthOf(share: number): CompetitorEntry['strength'] {
  return share >= 30 ? 'dominant' : share >= 15 ? 'strong' : share >= 5 ? 'moderate' : 'weak'
}

/**
 * Competition from real shares: HHI = Σ share² (0–10,000, the standard
 * concentration measure), saturation = share held by listed players (capped
 * at 100). Pressure and entry difficulty are MODELED from those two.
 */
export function competitiveFromShares(markets: Market[], rows: CompetitorRow[]): CompetitiveData[] {
  const byMarket = new Map<string, CompetitorRow[]>()
  for (const r of rows) {
    const list = byMarket.get(r.marketKey) ?? []
    list.push(r)
    byMarket.set(r.marketKey, list)
  }
  const out: CompetitiveData[] = []
  for (const m of markets) {
    const list = (byMarket.get(m.id) ?? []).sort((a, b) => b.marketSharePct - a.marketSharePct)
    if (!list.length) continue
    const saturation = Math.min(100, list.reduce((s, r) => s + r.marketSharePct, 0))
    const hhi = Math.round(list.reduce((s, r) => s + r.marketSharePct ** 2, 0))
    const pressure = Math.min(100, Math.round(saturation * 0.6 + (hhi / 10000) * 40))
    const difficulty = wsum([
      [0.5, opt(m.easeOfEntry, (e) => 100 - e)],
      [0.5, saturation],
    ])
    out.push({
      marketId: m.id,
      competitorCount: list.length,
      marketSaturation: Math.round(saturation),
      marketConcentration: hhi,
      competitiveDensity: Math.round(Math.min(95, saturation * 0.9 + 5)),
      topPlayers: list.slice(0, 5).map((r) => ({ name: r.competitor, marketShare: r.marketSharePct, strength: strengthOf(r.marketSharePct) })),
      competitivePressureScore: pressure,
      entryDifficultyScore: Math.min(100, Math.round(difficulty ?? saturation)),
    })
  }
  return out
}

/* ── Opportunity detection (rules; estimates are MODELED) ─────────────────── */

const n = (v: number | null): v is number => v !== null && Number.isFinite(v)

export function detectOpportunities(markets: Market[], competitive: CompetitiveData[]): Opportunity[] {
  const compMap = new Map(competitive.map((c) => [c.marketId, c]))
  const out: Opportunity[] = []
  markets.forEach((m, i) => {
    const comp = compMap.get(m.id)
    const g = m.gdpGrowth
    if (comp && n(g) && comp.marketSaturation < 35 && g > 5)
      out.push({
        id: `opp-${i}-1`, marketId: m.id, marketName: m.name, type: 'blue_ocean', title: `Blue Ocean in ${m.name}`,
        description: `High growth (${g}% GDP) with low saturation (${comp.marketSaturation}%).`,
        opportunityScore: Math.round(((m.opportunityScore ?? 50) + (100 - comp.marketSaturation)) / 2),
        marketPotential: n(m.gdp) ? Math.round(m.gdp * 0.08 * 1000) : 0,
        expectedRevenue: n(m.gdp) ? Math.round(m.gdp * 0.012 * 1000) : 0,
        confidenceScore: Math.round(65 + g * 3), timeHorizon: g > 7 ? 'short' : 'medium',
        drivers: [`${g}% GDP growth`, `Low saturation ${comp.marketSaturation}%`],
        risks: n(m.currencyStability) ? [`Currency stability ${m.currencyStability}/100`] : ['Currency risk not assessed'],
      })
    if (n(m.internetPenetration) && n(g) && m.internetPenetration < 65 && g > 4)
      out.push({
        id: `opp-${i}-2`, marketId: m.id, marketName: m.name, type: 'emerging', title: `Emerging Digital: ${m.name}`,
        description: `Accelerating digital adoption (${m.internetPenetration}% internet) in a largely untapped market.`,
        opportunityScore: Math.round((g * 8 + (100 - m.internetPenetration) * 0.4) / 2),
        marketPotential: n(m.population) ? Math.round(m.population * 45) : 0,
        expectedRevenue: n(m.population) ? Math.round(m.population * 6) : 0,
        confidenceScore: Math.round(55 + g * 2), timeHorizon: 'medium',
        drivers: [n(m.population) ? `${m.population}M population` : 'Population not provided', `${g}% growth`],
        risks: ['Infrastructure limits', 'Regulatory uncertainty'],
      })
    if (comp && n(m.purchasingPowerIndex) && m.purchasingPowerIndex > 65 && comp.marketSaturation < 50)
      out.push({
        id: `opp-${i}-3`, marketId: m.id, marketName: m.name, type: 'underserved', title: `Premium Underserved: ${m.name}`,
        description: `Strong purchasing power (PPI ${m.purchasingPowerIndex}) with limited premium competition.`,
        opportunityScore: Math.round((m.purchasingPowerIndex + (100 - comp.marketSaturation)) / 2),
        marketPotential: n(m.consumerSpending) ? Math.round(m.consumerSpending * 150) : 0,
        expectedRevenue: n(m.consumerSpending) ? Math.round(m.consumerSpending * 20) : 0,
        confidenceScore: n(m.easeOfDoingBusiness) ? Math.round(70 + (m.easeOfDoingBusiness - 60) * 0.5) : 60, timeHorizon: 'short',
        drivers: [`PPI ${m.purchasingPowerIndex}`, n(m.consumerSpending) ? `Consumer spend $${m.consumerSpending}B` : 'Consumer spend not modeled'],
        risks: ['Incumbent response'],
      })
    if (n(m.population) && n(g) && m.population > 50 && g > 3)
      out.push({
        id: `opp-${i}-4`, marketId: m.id, marketName: m.name, type: 'growth_surge', title: `Mass Market Surge: ${m.name}`,
        description: `${m.population}M population with ${g}% GDP growth — large addressable market.`,
        opportunityScore: Math.min(99, Math.round(g * 8 + Math.log10(m.population) * 15)),
        marketPotential: n(m.gdp) ? Math.round(m.gdp * 0.12 * 1000) : 0,
        expectedRevenue: n(m.gdp) ? Math.round(m.gdp * 0.015 * 1000) : 0,
        confidenceScore: Math.round(60 + g * 2.5), timeHorizon: 'medium',
        drivers: [`${m.population}M base`, `${g}% growth`],
        risks: ['Local competition', 'Logistics'],
      })
  })
  return out.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 150)
}
