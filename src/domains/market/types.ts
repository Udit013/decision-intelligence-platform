/**
 * Market domain types. A market comes either from the synthetic sample or from
 * a visitor's uploaded indicators; every indicator is optional (null = not
 * provided) and scores are computed only from what is present.
 */

export interface Market {
  id: string
  name: string
  code: string | null
  continent: string | null
  gdp: number | null // USD billions
  gdpGrowth: number | null // %
  gdpPerCapita: number | null // USD
  population: number | null // millions
  internetPenetration: number | null
  mobileAdoption: number | null
  urbanization: number | null
  avgIncome: number | null
  purchasingPowerIndex: number | null
  easeOfDoingBusiness: number | null
  taxRate: number | null
  inflationRate: number | null
  currencyStability: number | null
  /** MODELED from GDP and income (null when either is missing). */
  consumerSpending: number | null // USD billions
  marketAttractivenessScore: number | null
  opportunityScore: number | null
  riskScore: number | null
  easeOfEntry: number | null
  /** Share (0–1) of scoring inputs this market actually provided. */
  dataCoverage: number
  /** Synthetic-sample extras (never derived for uploaded data). */
  industryGrowth?: Record<string, number>
  historicalGdp?: Array<{ year: number; value: number }>
  historicalGrowth?: Array<{ year: number; value: number }>
}

export interface CompetitorEntry {
  name: string
  marketShare: number
  strength: 'dominant' | 'strong' | 'moderate' | 'weak'
}

export interface CompetitiveData {
  marketId: string
  competitorCount: number
  marketSaturation: number
  marketConcentration: number // HHI
  competitiveDensity: number
  topPlayers: CompetitorEntry[]
  competitivePressureScore: number
  entryDifficultyScore: number
}

export interface Opportunity {
  id: string
  marketId: string
  marketName: string
  type: 'blue_ocean' | 'growth_surge' | 'underserved' | 'emerging'
  title: string
  description: string
  opportunityScore: number
  marketPotential: number // USD millions
  expectedRevenue: number // USD millions
  confidenceScore: number
  timeHorizon: 'short' | 'medium' | 'long'
  drivers: string[]
  risks: string[]
}

export type EntryStrategy = 'direct' | 'partnership' | 'franchise' | 'distributor' | 'acquisition'

export interface EntryStrategyOption {
  strategy: EntryStrategy
  name: string
  cost: number // USD thousands
  risk: number
  timeToMarket: number // months
  expectedRoi: number // x multiple
  resourceRequirements: string[]
  description: string
  rank: number
}

export interface RiskProfile {
  overall: number | null
  economic: number | null
  competitive: number | null
  regulatory: number | null
  operational: number | null
  market: number | null
  mitigations: string[]
}

export type Recommendation = 'Expand' | 'Investigate' | 'Monitor' | 'Avoid'

export interface MarketDecision {
  marketId: string
  marketName: string
  recommendation: Recommendation
  /** 0–100 composite from core scoreAndClassify (modeled). */
  score: number
  rank: number
  opportunityScore: number | null
  riskScore: number | null
  easeOfEntry: number | null
  gdpGrowth: number | null
  marketSize: number | null
  /** Share (0–1) of the decision criteria this market had data for. */
  coverage: number
  /** modeled ROI multiple */
  expectedRoi: number
  investmentRequired: number | null // USD thousands
  reasoning: string
  keyDrivers: string[]
  /** per-criterion contributions to the score (the auditable "why") */
  contributions: { key: string; weighted: number }[]
}
