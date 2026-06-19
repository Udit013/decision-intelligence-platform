/**
 * Prioritization — RICE / ICE / WSJF.
 *
 * ✅ The RANKING + tier classification goes through core/scoreAndClassify (same
 * pattern as Market's Expand/Investigate/Monitor/Avoid): a single-criterion
 * ScoreConfig reads whichever model's score is active, and buckets map the result
 * to Now / Next / Later / Backlog. Switching model = switching the config's
 * criterion accessor — no separate ranking implementation.
 *
 * The RICE/ICE/WSJF arithmetic itself is the standard formula (a domain metric
 * definition), computed once per initiative below.
 */
import { scoreAndClassify, type Bucket } from '@/core/scoring'

export type ScoringModel = 'rice' | 'ice' | 'wsjf'

export interface InitiativeInput {
  name: string
  description: string
  reach: number // users/quarter
  impact: number // 0.25..3
  confidence: number // 0..1
  effort: number // person-weeks
  // WSJF cost-of-delay components
  userValue: number
  timeCriticality: number
  riskReduction: number
}

export interface RankedInitiative extends InitiativeInput {
  rice: number
  ice: number
  wsjf: number
  /** 0–100 normalized priority within the set, from core/scoreAndClassify */
  priority: number
  rank: number
  tier: string
}

// Standard formulas (metric definitions).
const rice = (i: InitiativeInput) => (i.effort > 0 ? Math.round((i.reach * i.impact * i.confidence) / i.effort) : 0)
const ice = (i: InitiativeInput) => Math.round(((i.impact / 3) * 10 + i.confidence * 10 + (10 - Math.min(10, i.effort))) / 3 * 10) / 10
const wsjf = (i: InitiativeInput) => (i.effort > 0 ? Math.round(((i.userValue + i.timeCriticality + i.riskReduction) / i.effort) * 10) / 10 : 0)

const TIERS: Bucket[] = [
  { label: 'Now', min: 75 },
  { label: 'Next', min: 50 },
  { label: 'Later', min: 25 },
  { label: 'Backlog', min: 0 },
]

const DEMO_INITIATIVES: InitiativeInput[] = [
  { name: 'AI Search GA', description: 'Ship AI Search to all plans.', reach: 8000, impact: 2, confidence: 0.8, effort: 6, userValue: 9, timeCriticality: 7, riskReduction: 4 },
  { name: 'Onboarding wizard revamp', description: 'Rebuild first-run experience.', reach: 10000, impact: 1.5, confidence: 0.9, effort: 4, userValue: 8, timeCriticality: 8, riskReduction: 6 },
  { name: 'Mobile app parity', description: 'Close feature gaps on mobile.', reach: 5000, impact: 2, confidence: 0.6, effort: 12, userValue: 7, timeCriticality: 5, riskReduction: 3 },
  { name: 'SSO + SCIM', description: 'Enterprise identity.', reach: 1200, impact: 3, confidence: 0.85, effort: 8, userValue: 6, timeCriticality: 6, riskReduction: 9 },
  { name: 'Usage-based billing', description: 'Meter and bill on usage.', reach: 3000, impact: 2.5, confidence: 0.5, effort: 16, userValue: 8, timeCriticality: 4, riskReduction: 5 },
  { name: 'Notification center', description: 'Unified in-app notifications.', reach: 9000, impact: 1, confidence: 0.9, effort: 3, userValue: 5, timeCriticality: 4, riskReduction: 2 },
  { name: 'Data export API', description: 'Programmatic exports.', reach: 2000, impact: 1.5, confidence: 0.8, effort: 5, userValue: 6, timeCriticality: 3, riskReduction: 4 },
  { name: 'Automation rules v2', description: 'No-code workflows.', reach: 4000, impact: 2, confidence: 0.65, effort: 10, userValue: 7, timeCriticality: 5, riskReduction: 4 },
]

export function rankInitiatives(model: ScoringModel = 'rice', items: InitiativeInput[] = DEMO_INITIATIVES): RankedInitiative[] {
  const withScores = items.map((i) => ({ ...i, rice: rice(i), ice: ice(i), wsjf: wsjf(i) }))
  const accessor = (x: (typeof withScores)[number]) => (model === 'rice' ? x.rice : model === 'ice' ? x.ice : x.wsjf)

  const ranked = scoreAndClassify(withScores, {
    criteria: [{ key: model, weight: 1, direction: 'higher', value: accessor }],
    buckets: TIERS,
  })

  return ranked.map((r) => ({ ...r.item, priority: r.score, rank: r.rank, tier: r.bucket ?? 'Backlog' }))
}

export { DEMO_INITIATIVES }
