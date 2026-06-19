/**
 * Assembles a full operations snapshot from the adapter + engines, wired through
 * /core. Used by the Decision Center, Reports, and Advisor so they agree. Returns
 * null when the database is empty/unreachable so pages can show a "run the ETL"
 * state instead of crashing (graceful when unseeded).
 */
import { clamp } from '@/core/stats'
import { forecast } from '@/core/forecast'
import { getKpis, getRevenueSeries, getCustomerRows, getCategoryComparison, getTopProducts } from './data'
import { computeCustomers } from './customers'
import { assembleRootCause } from './rootcause'
import { buildOperationsDecisions } from './decisions'

export async function buildSnapshot() {
  try {
    const kpis = await getKpis()
    if (!kpis.orders) return null // unseeded

    const { dates, values } = await getRevenueSeries('week')
    const horizon = 8
    const fc = forecast(values, dates, 'week', horizon)
    const projectedTotal = fc.series.filter((p) => p.actual === null).reduce((s, p) => s + (p.forecast ?? 0), 0)
    const backtestAccuracy = fc.backtest ? clamp(1 - fc.backtest.mape / 100, 0, 1) : 0.3

    const custRows = await getCustomerRows()
    const { summary } = computeCustomers(custRows, kpis.observedDays)

    const cats = await getCategoryComparison(90)
    const rc = assembleRootCause({ metricLabel: 'Revenue', categories: cats })

    const returns = { value: kpis.returnsValue, ratePct: kpis.returnsRatePct }
    const [topProducts, bottomProducts] = await Promise.all([getTopProducts(5), getTopProducts(5, true)])

    const decisions = buildOperationsDecisions({
      forecast: { projectedTotal, horizonLabel: `next ${horizon} weeks`, trendPerStep: fc.trendPerStep, backtestAccuracy, model: fc.model },
      customers: summary,
      returns,
      rootCause: rc,
    })

    return { kpis, fc, projectedTotal, horizon, backtestAccuracy, customers: summary, rootCause: rc, returns, decisions, topProducts, bottomProducts }
  } catch {
    return null
  }
}

export type OperationsSnapshot = NonNullable<Awaited<ReturnType<typeof buildSnapshot>>>
