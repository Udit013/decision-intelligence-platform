/**
 * Assembles a full operations snapshot from the adapter + engines, wired through
 * /core. Used by the Decision Center, Reports, and Advisor so they agree. Returns
 * null when the database is empty/unreachable so pages can show a "run the ETL"
 * state instead of crashing (graceful when unseeded).
 */
import { clamp } from '@/core/stats'
import { forecast } from '@/core/forecast'
import { getKpis, getRevenueSeries, getCustomerRows, getCategoryComparison } from './data'
import { computeCustomers } from './customers'
import { assembleRootCause } from './rootcause'
import { buildOperationsDecisions } from './decisions'

export async function buildSnapshot() {
  try {
    // The four queries are independent — run them in parallel so the Decision
    // Center is one round-trip's worth of latency, not five sequential ones.
    // (This was ~5.6s sequential and risked the serverless timeout on cold start,
    // which made buildSnapshot's catch fire and show a misleading "no data" state.)
    const [kpis, rev, custRows, cats] = await Promise.all([
      getKpis(),
      getRevenueSeries('week'),
      getCustomerRows(),
      getCategoryComparison(90),
    ])
    if (!kpis.orders) return null // genuinely unseeded

    const horizon = 8
    const fc = forecast(rev.values, rev.dates, 'week', horizon)
    const projectedTotal = fc.series.filter((p) => p.actual === null).reduce((s, p) => s + (p.forecast ?? 0), 0)
    const backtestAccuracy = fc.backtest ? clamp(1 - fc.backtest.mape / 100, 0, 1) : 0.3

    const { summary } = computeCustomers(custRows, kpis.observedDays)
    const rc = assembleRootCause({ metricLabel: 'Revenue', categories: cats })
    const returns = { value: kpis.returnsValue, ratePct: kpis.returnsRatePct }

    const decisions = buildOperationsDecisions({
      forecast: { projectedTotal, horizonLabel: `next ${horizon} weeks`, trendPerStep: fc.trendPerStep, backtestAccuracy, model: fc.model },
      customers: summary,
      returns,
      rootCause: rc,
    })

    return { kpis, fc, projectedTotal, horizon, backtestAccuracy, customers: summary, rootCause: rc, returns, decisions }
  } catch {
    return null
  }
}

export type OperationsSnapshot = NonNullable<Awaited<ReturnType<typeof buildSnapshot>>>
