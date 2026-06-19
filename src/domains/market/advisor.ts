/**
 * Market AI advisor wiring → core/advisor. Persona + grounded context + intent
 * rules; the orchestrator (Ollama-first, deterministic-always) lives in /core.
 */
import type { AdvisorContext, IntentRule } from '@/core/advisor'
import type { MarketDecision } from './types'
import { ADVISOR_PERSONA } from './config'

export { ADVISOR_PERSONA }

export interface MarketAdvisorSnapshot {
  marketCount: number
  topExpand: MarketDecision[]
  avoid: MarketDecision[]
  avgOpportunity: number
}

export function buildMarketContext(s: MarketAdvisorSnapshot): AdvisorContext {
  return {
    sections: [
      { label: 'overview', text: `${s.marketCount} synthetic markets analyzed (MODELED scores, no real data). Average opportunity ${s.avgOpportunity}.` },
      { label: 'top expand', text: s.topExpand.slice(0, 5).map((d, i) => `${i + 1}. ${d.marketName}: score ${d.score}, ROI ${d.expectedRoi}x, risk ${d.riskScore}`).join('; ') || 'none' },
      { label: 'avoid', text: s.avoid.slice(0, 5).map((d) => d.marketName).join(', ') || 'none' },
    ],
  }
}

export const MARKET_RULES: IntentRule<MarketAdvisorSnapshot>[] = [
  {
    match: ['which market', 'where', 'best market', 'recommend', 'expand', 'enter'],
    answer: (s) => {
      const t = s.topExpand[0]
      if (!t) return null
      return `Top modeled expansion target: ${t.marketName} (composite ${t.score}/100, modeled ROI ${t.expectedRoi}x, risk ${t.riskScore}). ${t.reasoning} Note: all figures are modeled on synthetic demo data — validate against real market research before acting.`
    },
  },
  {
    match: ['risk', 'safe', 'avoid', 'danger'],
    answer: (s) => `Markets the model flags to avoid: ${s.avoid.slice(0, 4).map((d) => `${d.marketName} (risk ${d.riskScore})`).join(', ') || 'none'}. These combine high modeled risk and/or low ease of entry. (Modeled, synthetic data.)`,
  },
  {
    match: ['roi', 'return', 'profit'],
    answer: (s) => `Highest modeled ROI targets: ${s.topExpand.slice(0, 3).map((d) => `${d.marketName} ${d.expectedRoi}x`).join(', ')}. ROI here is an illustrative model, not a forecast — treat as relative ranking only.`,
  },
]

export const marketFallback = (s: MarketAdvisorSnapshot): string =>
  `Across ${s.marketCount} modeled markets, the top expansion candidate is ${s.topExpand[0]?.marketName ?? 'n/a'} (composite ${s.topExpand[0]?.score ?? 'n/a'}/100). Open the Expansion Center for the ranked list. All scores are modeled on synthetic demo data.`
