/**
 * Product Decision Center — emits domain Signals and ranks them via core/recommend
 * (priority = impact × confidence). Same synthesizer Operations uses.
 */
import { synthesize, type Signal, type Recommendation } from '@/core/recommend'
import { rankInitiatives } from './prioritization'
import { discoverOpportunities } from './opportunities'
import type { ProductInsights } from './insights'

export function buildProductDecisions(ins: ProductInsights): Recommendation[] {
  const signals: Signal[] = []

  // 1. Top RICE initiative.
  const top = ins.initiatives.length ? rankInitiatives('rice', ins.initiatives)[0] : undefined
  if (top) {
    signals.push({
      id: 'ship-top',
      category: 'Roadmap',
      title: `Ship "${top.name}" next`,
      recommendation: `Highest RICE initiative (${top.rice}).${top.description ? ` ${top.description}` : ''}`,
      expectedResult: `Reaches ~${top.reach.toLocaleString()} users/qtr`,
      confidence: top.confidence,
      impact: top.reach * top.impact,
      reasoning: `RICE ${top.rice}, tier ${top.tier} — ranked #1 by core/scoreAndClassify.`,
    })
  }

  // 2. Significant experiment winners → roll out.
  for (const e of ins.experiments.filter((x) => x.stats.verdict === 'winner')) {
    signals.push({
      id: `rollout-${e.name}`,
      category: 'Experiment',
      title: `Roll out: ${e.name}`,
      recommendation: `Significant winner (+${e.stats.liftPercent.toFixed(1)}% lift, p=${e.stats.pValue.toFixed(3)}). Ship to 100%.`,
      expectedResult: `+${e.stats.liftPercent.toFixed(1)}% on the primary metric`,
      confidence: e.stats.confidenceLevel / 100,
      impact: Math.abs(e.stats.lift) * e.treatmentSamples * 10,
      reasoning: `Two-proportion z-test (core/stats): z=${e.stats.zStat.toFixed(2)}, p=${e.stats.pValue.toFixed(3)}.`,
    })
  }

  // 3. Top discovered opportunity.
  const opp = discoverOpportunities(ins)[0]
  if (opp) {
    signals.push({
      id: `opp-${opp.id}`,
      category: 'Opportunity',
      title: opp.title,
      recommendation: opp.description,
      expectedResult: `${opp.affectedUsers.toLocaleString()} users affected`,
      confidence: 0.6,
      impact: opp.affectedUsers,
      reasoning: `Discovered from measured product analytics (type: ${opp.type}).`,
    })
  }

  return synthesize(signals)
}
