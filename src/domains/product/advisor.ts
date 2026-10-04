/** Product AI advisor wiring → core/advisor (persona + context + intent rules). */
import type { AdvisorContext, IntentRule } from '@/core/advisor'
import { ADVISOR_PERSONA } from './config'

export { ADVISOR_PERSONA }

export interface ProductAdvisorSnapshot {
  /** true for the synthetic sample, false for the visitor's own data */
  demo: boolean
  userCount: number
  retention: { offset: number; ratePct: number | null }[]
  funnelWorst: { from: string; to: string; drop: number }
  topInitiative: { name: string; rice: number; tier: string } | null
  winners: { name: string; lift: number }[]
}

const ret = (s: ProductAdvisorSnapshot, off: number) => {
  const v = s.retention.find((r) => r.offset === off)?.ratePct
  return v === null || v === undefined ? 'n/a' : `${v}%`
}
const provenance = (s: ProductAdvisorSnapshot) => (s.demo ? ' (Measured from synthetic data.)' : ' (Measured from your imported events.)')
const topText = (s: ProductAdvisorSnapshot) =>
  s.topInitiative ? `${s.topInitiative.name} (RICE ${s.topInitiative.rice}, tier ${s.topInitiative.tier})` : 'not available — import a backlog'

export function buildProductContext(s: ProductAdvisorSnapshot): AdvisorContext {
  return {
    sections: [
      { label: 'retention', text: `Measured D1 ${ret(s, 1)}, D7 ${ret(s, 7)}, D30 ${ret(s, 30)}, D90 ${ret(s, 90)} across ${s.userCount} users.` },
      { label: 'funnel', text: `Biggest drop-off: ${s.funnelWorst.from} → ${s.funnelWorst.to} (${s.funnelWorst.drop}%).` },
      { label: 'roadmap', text: `Top RICE initiative: ${topText(s)}.` },
      { label: 'experiments', text: s.winners.length ? `Significant winners: ${s.winners.map((w) => `${w.name} (+${w.lift.toFixed(1)}%)`).join('; ')}.` : 'No significant winners yet.' },
    ],
  }
}

export const PRODUCT_RULES: IntentRule<ProductAdvisorSnapshot>[] = [
  { match: ['retention', 'retain', 'churn', 'd1', 'd7', 'd30', 'd90', 'sticky'], answer: (s) => `Measured retention: D1 ${ret(s, 1)}, D7 ${ret(s, 7)}, D30 ${ret(s, 30)}, D90 ${ret(s, 90)}. The steepest fall is early — invest in first-week habit loops.${provenance(s)}` },
  { match: ['funnel', 'drop', 'convert', 'activation', 'onboard'], answer: (s) => `The biggest funnel leak is ${s.funnelWorst.from} → ${s.funnelWorst.to} (−${s.funnelWorst.drop}%). Fix this step first; it compounds downstream.` },
  { match: ['build', 'roadmap', 'prioriti', 'next', 'ship', 'rice'], answer: (s) => s.topInitiative ? `Top RICE initiative is ${topText(s)} — ranked by core/scoreAndClassify. Ship it next.` : 'No backlog is imported yet — add one (initiative, reach, impact, confidence, effort) to get a ranked roadmap.' },
  { match: ['experiment', 'test', 'a/b', 'ab test', 'significant'], answer: (s) => (s.winners.length ? `Significant winners to roll out: ${s.winners.map((w) => `${w.name} (+${w.lift.toFixed(1)}%)`).join('; ')}. (Two-proportion z-test via core/stats.)` : 'No experiments reached significance — keep them running or increase power.') },
]

export const productFallback = (s: ProductAdvisorSnapshot): string =>
  `Across ${s.userCount} users: D30 retention ${ret(s, 30)}, biggest funnel leak ${s.funnelWorst.from}→${s.funnelWorst.to}, top initiative ${s.topInitiative?.name ?? 'n/a'}. Open the Decision Center for the ranked list.${provenance(s)}`
