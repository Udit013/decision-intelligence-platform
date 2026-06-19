/** Market domain types (ported from geostrategy). All values are SYNTHETIC demo data. */

export interface Market {
  id: string
  name: string
  code: string
  continent: string
  gdp: number // USD billions
  gdpGrowth: number // %
  gdpPerCapita: number // USD
  population: number // millions
  internetPenetration: number
  mobileAdoption: number
  urbanization: number
  avgIncome: number
  purchasingPowerIndex: number
  easeOfDoingBusiness: number
  taxRate: number
  inflationRate: number
  currencyStability: number
  consumerSpending: number // USD billions
  industryGrowth: Record<string, number>
  marketAttractivenessScore: number
  opportunityScore: number
  riskScore: number
  easeOfEntry: number
  historicalGdp: Array<{ year: number; value: number }>
  historicalGrowth: Array<{ year: number; value: number }>
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
  overall: number
  economic: number
  competitive: number
  regulatory: number
  operational: number
  market: number
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
  opportunityScore: number
  riskScore: number
  easeOfEntry: number
  gdpGrowth: number
  marketSize: number
  /** modeled ROI multiple */
  expectedRoi: number
  investmentRequired: number // USD thousands
  reasoning: string
  keyDrivers: string[]
  /** per-criterion contributions to the score (the auditable "why") */
  contributions: { key: string; weighted: number }[]
}
