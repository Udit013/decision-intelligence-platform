/** Product AI advisor wiring → core/advisor (persona + context + intent rules). */
import type { AdvisorContext, IntentRule } from '@/core/advisor'
import { ADVISOR_PERSONA } from './config'

export { ADVISOR_PERSONA }

export interface ProductAdvisorSnapshot {
  userCount: number
  retention: { offset: number; ratePct: number }[]
  funnelWorst: { from: string; to: string; drop: number }
  topInitiative: { name: string; rice: number; tier: string }
  winners: { name: string; lift: number }[]
}

const ret = (s: ProductAdvisorSnapshot, off: number) => s.retention.find((r) => r.offset === off)?.ratePct ?? 0

export function buildProductContext(s: ProductAdvisorSnapshot): AdvisorContext {
  return {
    sections: [
      { label: 'retention', text: `Measured D1 ${ret(s, 1)}%, D7 ${ret(s, 7)}%, D30 ${ret(s, 30)}%, D90 ${ret(s, 90)}% across ${s.userCount} users.` },
      { label: 'funnel', text: `Biggest drop-off: ${s.funnelWorst.from} → ${s.funnelWorst.to} (${s.funnelWorst.drop}%).` },
      { label: 'roadmap', text: `Top RICE initiative: ${s.topInitiative.name} (RICE ${s.topInitiative.rice}, tier ${s.topInitiative.tier}).` },
      { label: 'experiments', text: s.winners.length ? `Significant winners: ${s.winners.map((w) => `${w.name} (+${w.lift.toFixed(1)}%)`).join('; ')}.` : 'No significant winners yet.' },
    ],
  }
}

export const PRODUCT_RULES: IntentRule<ProductAdvisorSnapshot>[] = [
  { match: ['retention', 'retain', 'churn', 'd1', 'd7', 'd30', 'd90', 'sticky'], answer: (s) => `Measured retention: D1 ${ret(s, 1)}%, D7 ${ret(s, 7)}%, D30 ${ret(s, 30)}%, D90 ${ret(s, 90)}%. The steepest fall is early — invest in first-week habit loops. (Measured from synthetic data.)` },
  { match: ['funnel', 'drop', 'convert', 'activation', 'onboard'], answer: (s) => `The biggest funnel leak is ${s.funnelWorst.from} → ${s.funnelWorst.to} (−${s.funnelWorst.drop}%). Fix this step first; it compounds downstream.` },
  { match: ['build', 'roadmap', 'prioriti', 'next', 'ship', 'rice'], answer: (s) => `Top RICE initiative is ${s.topInitiative.name} (RICE ${s.topInitiative.rice}, tier ${s.topInitiative.tier}) — ranked by core/scoreAndClassify. Ship it next.` },
  { match: ['experiment', 'test', 'a/b', 'ab test', 'significant'], answer: (s) => (s.winners.length ? `Significant winners to roll out: ${s.winners.map((w) => `${w.name} (+${w.lift.toFixed(1)}%)`).join('; ')}. (Two-proportion z-test via core/stats.)` : 'No experiments reached significance — keep them running or increase power.') },
]

export const productFallback = (s: ProductAdvisorSnapshot): string =>
  `Across ${s.userCount} users: D30 retention ${ret(s, 30)}%, biggest funnel leak ${s.funnelWorst.from}→${s.funnelWorst.to}, top initiative ${s.topInitiative.name}. Open the Decision Center for the ranked list. (Synthetic demo data; retention/funnel are measured from it.)`
