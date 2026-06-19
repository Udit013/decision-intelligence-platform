/**
 * Customer intelligence — RFM segmentation (via core/segmentation) + a 12-month
 * predicted-value estimate and churn risk. All inputs (recency/frequency/monetary)
 * are REAL. Predicted value is in REVENUE terms (real-derived) to avoid leaning on
 * the cost assumption; a gross-profit view would be an estimate and is labeled as
 * such where shown.
 */
import { computeRfm } from '@/core/segmentation'
import { clamp } from '@/core/stats'

export interface CustomerRow {
  customerId: string
  country: string | null
  /** days since last purchase (real) */
  recency: number
  /** distinct orders (real) */
  frequency: number
  /** total revenue (real) */
  monetary: number
}

export interface CustomerScore extends CustomerRow {
  r: number
  f: number
  m: number
  rfm: number
  segment: string
  /** predicted next-12-month revenue (real-derived projection) */
  predicted12moValue: number
  /** 0–1 churn risk from recency vs cadence */
  churnRisk: number
}

export interface CustomerSummary {
  totalCustomers: number
  totalPredictedValue: number
  atRiskValue: number
  atRiskCount: number
  vipCount: number
  vipValue: number
  segments: { segment: string; count: number; value: number; predicted: number }[]
}

const AT_RISK = new Set(['At Risk', 'Hibernating', 'Needs Attention'])
const VIP = new Set(['Champions', 'Loyal'])

/** Compute per-customer scores. `observedDays` = span of the dataset for annualizing. */
export function computeCustomers(rows: CustomerRow[], observedDays: number): {
  customers: CustomerScore[]
  summary: CustomerSummary
} {
  if (!rows.length) {
    return {
      customers: [],
      summary: { totalCustomers: 0, totalPredictedValue: 0, atRiskValue: 0, atRiskCount: 0, vipCount: 0, vipValue: 0, segments: [] },
    }
  }
  const years = Math.max(0.25, observedDays / 365)
  const scored = computeRfm(rows, 5)

  const customers: CustomerScore[] = scored.map((c) => {
    const annualOrders = c.frequency / years
    const aov = c.frequency > 0 ? c.monetary / c.frequency : 0
    const predicted12moValue = Math.round(annualOrders * aov)
    // Expected inter-purchase interval (days); churn rises as recency exceeds it.
    const expectedInterval = annualOrders > 0 ? 365 / annualOrders : observedDays
    const churnRisk = clamp(c.recency / (expectedInterval * 1.5), 0, 1)
    return { ...c, predicted12moValue, churnRisk: Math.round(churnRisk * 100) / 100 }
  })

  const bySeg = new Map<string, { count: number; value: number; predicted: number }>()
  let totalPredictedValue = 0
  let atRiskValue = 0
  let atRiskCount = 0
  let vipCount = 0
  let vipValue = 0
  for (const c of customers) {
    totalPredictedValue += c.predicted12moValue
    const s = bySeg.get(c.segment) ?? { count: 0, value: 0, predicted: 0 }
    s.count++
    s.value += c.monetary
    s.predicted += c.predicted12moValue
    bySeg.set(c.segment, s)
    if (AT_RISK.has(c.segment)) {
      atRiskValue += c.predicted12moValue
      atRiskCount++
    }
    if (VIP.has(c.segment)) {
      vipCount++
      vipValue += c.predicted12moValue
    }
  }

  return {
    customers,
    summary: {
      totalCustomers: customers.length,
      totalPredictedValue: Math.round(totalPredictedValue),
      atRiskValue: Math.round(atRiskValue),
      atRiskCount,
      vipCount,
      vipValue: Math.round(vipValue),
      segments: [...bySeg.entries()]
        .map(([segment, v]) => ({ segment, count: v.count, value: Math.round(v.value), predicted: Math.round(v.predicted) }))
        .sort((a, b) => b.predicted - a.predicted),
    },
  }
}
