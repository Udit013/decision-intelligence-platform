/**
 * Operations data adapter — the ONLY place that talks SQL for this domain.
 * Centralizes queries over the operations_* tables so the engines and pages share
 * one source of truth. All aggregates use clean sale lines (quantity > 0, price > 0,
 * non-return) except the returns metric, which intentionally reads credit notes.
 */
import { unstable_cache } from 'next/cache'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'

// The Online Retail II dataset is static once seeded, so query results are cached
// across requests (revalidated hourly). First load pays the ~4s; every load after
// is served from the data cache — keeping the Decision Center and advisor snappy.
// Bump the revalidate window or call revalidateTag('operations') after a re-ETL.
const CACHE = { revalidate: 3600, tags: ['operations'] }

export type Grain = 'day' | 'week' | 'month'
const GRAIN_UNIT: Record<Grain, string> = { day: 'day', week: 'week', month: 'month' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsOf(result: any): Record<string, unknown>[] {
  return Array.isArray(result) ? result : (result?.rows ?? [])
}
const num = (v: unknown) => Number(v ?? 0)

export interface OpsKpis {
  revenue: number
  orders: number
  customers: number
  aov: number
  returnsValue: number
  returnsRatePct: number
  dateMin: string
  dateMax: string
  observedDays: number
}

async function getKpisImpl(): Promise<OpsKpis> {
  const db = getDb()
  const [mainRes, custRes] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN quantity > 0 AND unit_price > 0 THEN line_revenue END), 0) AS revenue,
        COUNT(DISTINCT CASE WHEN quantity > 0 AND unit_price > 0 THEN invoice END) AS orders,
        MIN(invoice_date)::date AS date_min,
        MAX(invoice_date)::date AS date_max,
        COALESCE(SUM(CASE WHEN line_revenue < 0 OR quantity < 0 THEN ABS(line_revenue) END), 0) AS returns_value
      FROM operations_invoice_lines
    `),
    db.execute(sql`SELECT COUNT(*)::int AS c FROM operations_customers`),
  ])
  const r = rowsOf(mainRes)[0]
  const custRow = rowsOf(custRes)[0]
  const revenue = num(r.revenue)
  const orders = num(r.orders)
  const returnsValue = num(r.returns_value)
  const dateMin = String(r.date_min ?? '').slice(0, 10)
  const dateMax = String(r.date_max ?? '').slice(0, 10)
  const observedDays = dateMin && dateMax ? Math.max(1, (new Date(dateMax).getTime() - new Date(dateMin).getTime()) / 86400000) : 1
  return {
    revenue,
    orders,
    customers: num(custRow.c),
    aov: orders > 0 ? revenue / orders : 0,
    returnsValue,
    returnsRatePct: revenue > 0 ? Math.round((returnsValue / revenue) * 1000) / 10 : 0,
    dateMin,
    dateMax,
    observedDays,
  }
}

/** Net revenue time series at the requested grain (clean sale lines only). */
async function getRevenueSeriesImpl(grain: Grain = 'week'): Promise<{ dates: string[]; values: number[] }> {
  const unit = GRAIN_UNIT[grain]
  const r = rowsOf(
    await getDb().execute(sql`
      SELECT to_char(date_trunc(${unit}, invoice_date), 'YYYY-MM-DD') AS d,
             ROUND(SUM(line_revenue)::numeric, 2) AS revenue
      FROM operations_invoice_lines
      WHERE quantity > 0 AND unit_price > 0
      GROUP BY 1 ORDER BY 1
    `),
  )
  return { dates: r.map((x) => String(x.d)), values: r.map((x) => Math.round(num(x.revenue))) }
}

async function getCustomerRowsImpl() {
  const r = rowsOf(
    await getDb().execute(sql`
      WITH maxd AS (SELECT MAX(invoice_date) AS m FROM operations_invoice_lines)
      SELECT i.customer_id,
             MAX(i.country) AS country,
             EXTRACT(DAY FROM ((SELECT m FROM maxd) - MAX(l.invoice_date))) AS recency_days,
             COUNT(DISTINCT l.invoice) AS frequency,
             ROUND(SUM(l.line_revenue)::numeric, 2) AS monetary
      FROM operations_invoice_lines l
      JOIN operations_invoices i ON i.invoice = l.invoice
      WHERE i.customer_id IS NOT NULL AND l.quantity > 0 AND l.unit_price > 0
      GROUP BY i.customer_id
    `),
  )
  return r.map((x) => ({
    customerId: String(x.customer_id),
    country: x.country ? String(x.country) : null,
    recency: Math.max(0, Math.round(num(x.recency_days))),
    frequency: num(x.frequency),
    monetary: num(x.monetary),
  }))
}

/** Per-product demand stats for the inventory/pricing engines (top N by revenue). */
async function getDemandRowsImpl(limit = 200) {
  const r = rowsOf(
    await getDb().execute(sql`
      WITH daily AS (
        SELECT l.stock_code, date_trunc('day', l.invoice_date) AS d,
               SUM(l.quantity) AS qty, AVG(l.unit_price) AS price
        FROM operations_invoice_lines l
        WHERE l.quantity > 0 AND l.unit_price > 0
        GROUP BY 1, 2
      )
      SELECT d.stock_code,
             p.description, p.category, p.assumed_cost_ratio,
             AVG(d.qty) AS avg_daily, COALESCE(STDDEV_SAMP(d.qty), 0) AS std_daily,
             AVG(d.price) AS unit_price, SUM(d.qty) AS total_qty
      FROM daily d
      JOIN operations_products p ON p.stock_code = d.stock_code
      GROUP BY d.stock_code, p.description, p.category, p.assumed_cost_ratio
      ORDER BY SUM(d.qty * d.price) DESC
      LIMIT ${limit}
    `),
  )
  return r.map((x) => {
    const unitPrice = num(x.unit_price)
    const costRatio = num(x.assumed_cost_ratio) || 0.5
    return {
      stockCode: String(x.stock_code),
      description: x.description ? String(x.description) : null,
      category: String(x.category ?? 'Other'),
      avgDailyDemand: Math.round(num(x.avg_daily) * 100) / 100,
      demandStd: Math.round(num(x.std_daily) * 100) / 100,
      unitPrice: Math.round(unitPrice * 100) / 100,
      unitCost: Math.round(unitPrice * costRatio * 100) / 100,
    }
  })
}

/** Category revenue for the last `windowDays` vs the prior `windowDays` (root cause). */
async function getCategoryComparisonImpl(windowDays = 90) {
  const r = rowsOf(
    await getDb().execute(sql`
      WITH bounds AS (SELECT MAX(invoice_date) AS maxd FROM operations_invoice_lines)
      SELECT p.category,
        COALESCE(SUM(CASE WHEN l.invoice_date > (SELECT maxd FROM bounds) - (${windowDays} || ' days')::interval THEN l.line_revenue END), 0) AS current,
        COALESCE(SUM(CASE WHEN l.invoice_date <= (SELECT maxd FROM bounds) - (${windowDays} || ' days')::interval
                          AND l.invoice_date > (SELECT maxd FROM bounds) - (${windowDays * 2} || ' days')::interval THEN l.line_revenue END), 0) AS prior
      FROM operations_invoice_lines l
      JOIN operations_products p ON p.stock_code = l.stock_code
      WHERE l.quantity > 0 AND l.unit_price > 0
      GROUP BY p.category
    `),
  )
  return r.map((x) => ({ name: String(x.category ?? 'Other'), current: num(x.current), prior: num(x.prior) }))
}

async function getTopProductsImpl(limit = 10, ascending = false) {
  const r = rowsOf(
    await getDb().execute(sql`
      SELECT p.description, ROUND(SUM(l.line_revenue)::numeric, 2) AS revenue
      FROM operations_invoice_lines l
      JOIN operations_products p ON p.stock_code = l.stock_code
      WHERE l.quantity > 0 AND l.unit_price > 0
      GROUP BY p.description
      ORDER BY SUM(l.line_revenue) ${ascending ? sql`ASC` : sql`DESC`}
      LIMIT ${limit}
    `),
  )
  return r.map((x) => ({ name: x.description ? String(x.description) : 'Unknown', revenue: num(x.revenue) }))
}

/* ── Cached exports ──────────────────────────────────────────────────────────
 * Every consumer (Decision Center, Reports, Advisor API, sub-pages) imports these
 * names; wrapping the impls in unstable_cache memoizes the expensive queries
 * across requests. Arguments are part of the cache key, so each grain / window /
 * limit caches independently. */
export const getKpis = unstable_cache(getKpisImpl, ['ops:kpis'], CACHE)
export const getRevenueSeries = unstable_cache(getRevenueSeriesImpl, ['ops:revenue-series'], CACHE)
export const getCustomerRows = unstable_cache(getCustomerRowsImpl, ['ops:customers'], CACHE)
export const getDemandRows = unstable_cache(getDemandRowsImpl, ['ops:demand'], CACHE)
export const getCategoryComparison = unstable_cache(getCategoryComparisonImpl, ['ops:category-cmp'], CACHE)
export const getTopProducts = unstable_cache(getTopProductsImpl, ['ops:top-products'], CACHE)
