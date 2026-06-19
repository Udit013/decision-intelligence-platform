/**
 * Operations Decision Center — turns the engine outputs into domain Signals and
 * hands them to core/recommend for ranking. The priority math (impact × confidence)
 * and sorting live in /core; this file only describes the domain's signals.
 *
 * Forecast confidence is taken from the MEASURED backtest accuracy, not a guess —
 * so a near-mean forecast (R²≈0) yields low confidence and ranks below firmer
 * signals like customer value at risk.
 */
import { synthesize, type Signal, type Recommendation } from '@/core/recommend'

const money = (n: number) => {
  const a = Math.abs(Math.round(n))
  const s = a >= 1e6 ? `£${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `£${(a / 1e3).toFixed(1)}K` : `£${a}`
  return n < 0 ? `-${s}` : s
}

export interface DecisionInputs {
  forecast: {
    projectedTotal: number
    horizonLabel: string
    trendPerStep: number
    /** measured out-of-sample accuracy 0–1 (e.g. 1 − MAPE/100, floored at 0) */
    backtestAccuracy: number
    model: string
  }
  customers: { atRiskValue: number; atRiskCount: number; vipValue: number; vipCount: number }
  returns: { value: number; ratePct: number }
  rootCause: { changePct: number; topDrag: string | null; topDriver: string | null } | null
}

export function buildOperationsDecisions(inp: DecisionInputs): Recommendation[] {
  const signals: Signal[] = []
  const f = inp.forecast
  const growing = f.trendPerStep >= 0

  signals.push({
    id: 'forecast-trend',
    category: growing ? 'Growth' : 'Risk',
    title: growing ? `Capitalize on projected revenue growth` : `Mitigate projected revenue decline`,
    recommendation: growing
      ? `Forecast trends up over the ${f.horizonLabel}. Align inventory and marketing to capture ~${money(f.projectedTotal)}.`
      : `Forecast trends down over the ${f.horizonLabel}. Launch demand-gen before the dip.`,
    expectedResult: `${money(f.projectedTotal)} projected revenue (${f.horizonLabel})`,
    confidence: f.backtestAccuracy,
    impact: Math.abs(f.projectedTotal),
    reasoning: `${f.model}; measured out-of-sample accuracy ${Math.round(f.backtestAccuracy * 100)}% (low on this spiky series — treat as directional).`,
    metrics: [{ label: 'Accuracy', value: `${Math.round(f.backtestAccuracy * 100)}%` }],
  })

  if (inp.customers.atRiskValue > 0) {
    signals.push({
      id: 'customer-winback',
      category: 'Customer',
      title: `Win back ${inp.customers.atRiskCount} at-risk customers`,
      recommendation: `Target at-risk / hibernating customers with a personalized win-back before their value lapses.`,
      expectedResult: `Recover up to ${money(inp.customers.atRiskValue)} predicted value`,
      confidence: 0.7,
      impact: inp.customers.atRiskValue,
      reasoning: `These customers carry ${money(inp.customers.atRiskValue)} of predicted 12-month value but show high churn risk from recency vs cadence.`,
    })
  }

  if (inp.customers.vipValue > 0) {
    signals.push({
      id: 'customer-vip',
      category: 'Customer',
      title: `Protect ${inp.customers.vipCount} VIP customers`,
      recommendation: `Enroll Champions/Loyal in loyalty / early-access to defend ${money(inp.customers.vipValue)} of value.`,
      expectedResult: `Defend ${money(inp.customers.vipValue)} VIP value`,
      confidence: 0.75,
      impact: inp.customers.vipValue * 0.5,
      reasoning: `VIPs concentrate a large share of predicted value; retention here has outsized ROI.`,
    })
  }

  if (inp.returns.value > 0) {
    signals.push({
      id: 'returns',
      category: 'Risk',
      title: `Reduce returns (${inp.returns.ratePct}% of gross)`,
      recommendation: `Investigate top return-driving SKUs and listings; even a 1pt cut recovers real margin.`,
      expectedResult: `${money(inp.returns.value)} returned annually`,
      confidence: 0.6,
      impact: inp.returns.value,
      reasoning: `Returns run at ${inp.returns.ratePct}% of gross sales (from credit-note invoices).`,
    })
  }

  if (inp.rootCause && inp.rootCause.changePct < 0 && inp.rootCause.topDrag) {
    signals.push({
      id: 'root-cause',
      category: 'Risk',
      title: `Address decline led by ${inp.rootCause.topDrag}`,
      recommendation: `Revenue is down ${Math.abs(inp.rootCause.changePct)}% — focus on ${inp.rootCause.topDrag}, the largest drag.`,
      expectedResult: `${inp.rootCause.changePct}% recent revenue trend`,
      confidence: 0.65,
      impact: Math.abs(inp.rootCause.changePct) * 10000,
      reasoning: `Root-cause decomposition attributes most of the recent change to ${inp.rootCause.topDrag}.`,
    })
  }

  return synthesize(signals)
}
