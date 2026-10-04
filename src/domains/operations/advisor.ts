/**
 * Operations AI advisor wiring — supplies the persona, the grounded context
 * document, and the deterministic intent rules to core/advisor. The orchestrator
 * (local Ollama first, deterministic always) lives in /core; this is config only.
 */
import type { AdvisorContext, IntentRule } from '@/core/advisor'
import { ADVISOR_PERSONA } from './config'
import { money as formatMoney } from './format'

export interface OpsSnapshot {
  /** Currency symbol for display ('' for uploaded data of unknown currency). */
  currency: string
  forecast: { projectedTotal: number; trendPerStep: number; backtestMape: number | null; model: string }
  customers: { totalPredictedValue: number; atRiskValue: number; atRiskCount: number; vipCount: number }
  returns: { value: number; ratePct: number }
  rootCause: { summary: string; topDriver: string | null; topDrag: string | null; recommendations: string[] } | null
  topDecisions: { title: string; expectedResult: string; confidence: number }[]
}

export { ADVISOR_PERSONA }

/** Build the structured context document for the LLM prompt. */
export function buildOpsContext(s: OpsSnapshot): AdvisorContext {
  const sections = [
    {
      label: 'forecast',
      text: `${s.forecast.model}: next-period revenue ~${formatMoney(s.forecast.projectedTotal, s.currency)}, trend ${s.forecast.trendPerStep >= 0 ? 'up' : 'down'}${s.forecast.backtestMape != null ? `, but measured out-of-sample MAPE is ${s.forecast.backtestMape}% (low accuracy — treat as directional)` : ''}.`,
    },
    {
      label: 'customers',
      text: `${s.customers.atRiskCount} at-risk customers worth ${formatMoney(s.customers.atRiskValue, s.currency)}; ${s.customers.vipCount} VIPs; total predicted 12-mo value ${formatMoney(s.customers.totalPredictedValue, s.currency)}.`,
    },
    { label: 'returns', text: `${s.returns.ratePct}% of gross (${formatMoney(s.returns.value, s.currency)}).` },
  ]
  if (s.rootCause) sections.push({ label: 'recent trend', text: `${s.rootCause.summary} Top driver: ${s.rootCause.topDriver ?? 'n/a'}; biggest drag: ${s.rootCause.topDrag ?? 'n/a'}.` })
  if (s.topDecisions.length)
    sections.push({ label: 'top decisions', text: s.topDecisions.map((d) => `${d.title} → ${d.expectedResult} (${Math.round(d.confidence * 100)}%)`).join('; ') })
  return { sections }
}

/** Deterministic intent rules (the always-available fallback). */
export const OPS_RULES: IntentRule<OpsSnapshot>[] = [
  {
    match: ['forecast', 'predict', 'next', 'future', 'outlook', 'project'],
    answer: (s) =>
      `The ${s.forecast.model} projects ~${formatMoney(s.forecast.projectedTotal, s.currency)} next period (trend ${s.forecast.trendPerStep >= 0 ? 'up' : 'down'}). Caveat: measured out-of-sample accuracy is low on this spiky series${s.forecast.backtestMape != null ? ` (MAPE ${s.forecast.backtestMape}%)` : ''}, so treat it as directional and plan against the prediction interval, not the point estimate.`,
  },
  {
    match: ['churn', 'retain', 'at risk', 'win back', 'win-back', 'lapse'],
    answer: (s) =>
      `You have ${s.customers.atRiskCount} at-risk/hibernating customers carrying ${formatMoney(s.customers.atRiskValue, s.currency)} of predicted value. Launch a personalized win-back before it lapses, and protect your ${s.customers.vipCount} VIPs with loyalty perks.`,
  },
  {
    match: ['return', 'refund', 'cancel'],
    answer: (s) => `Returns run at ${s.returns.ratePct}% of gross (${formatMoney(s.returns.value, s.currency)}). Audit the top return-driving SKUs and product listings; a 1pt reduction recovers real margin.`,
  },
  {
    match: ['why', 'decline', 'drop', 'driver', 'cause', 'grew', 'growth'],
    answer: (s) => (s.rootCause ? `${s.rootCause.summary} ${s.rootCause.recommendations[0] ?? ''}` : null),
  },
  {
    match: ['price', 'pricing', 'discount', 'promo', 'margin'],
    answer: () =>
      `Use the Pricing simulator to model elasticity scenarios. Note margin/profit are ESTIMATES — the dataset has no cost, so cost is assumed per category. For low-elasticity categories a small price rise can lift estimated profit; deep discounts only pay off if volume outweighs the margin hit.`,
  },
]

export const opsFallback = (s: OpsSnapshot): string =>
  s.topDecisions.length
    ? `Top moves now: ${s.topDecisions.slice(0, 3).map((d, i) => `${i + 1}) ${d.title} — ${d.expectedResult} (${Math.round(d.confidence * 100)}%)`).join('; ')}. See the Decision Center for the ranked list.`
    : `Ask about the forecast, customer churn, returns, or pricing and I'll answer from the latest operations data.`
