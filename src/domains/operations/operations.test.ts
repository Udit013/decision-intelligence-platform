import { describe, it, expect } from 'vitest'
import { deriveCategory, assumedCostRatioFor } from './assumptions'
import { simulatePrice, simulatePromo, PROMOS, type Baseline } from './pricing'
import { computeInventoryPlan } from './inventory'
import { computeCustomers, type CustomerRow } from './customers'
import { assembleRootCause } from './rootcause'
import { buildOperationsDecisions } from './decisions'

describe('assumptions', () => {
  it('derives categories from descriptions', () => {
    expect(deriveCategory('WHITE HANGING HEART T-LIGHT HOLDER')).toBe('Home & Decor')
    expect(deriveCategory('JUMBO BAG RED RETROSPOT')).toBe('Bags & Storage')
    expect(deriveCategory('REGENCY CAKESTAND 3 TIER')).toBe('Kitchen & Dining')
    expect(deriveCategory('PACK OF 12 CHRISTMAS TISSUES')).toBe('Party & Seasonal')
    expect(deriveCategory(null)).toBe('Other')
    expect(deriveCategory('SOMETHING UNMATCHABLE XYZ')).toBe('Other')
  })

  it('cost ratios are within (0,1)', () => {
    for (const c of ['Kitchen & Dining', 'Other', 'Jewellery & Accessories'] as const) {
      const r = assumedCostRatioFor(c)
      expect(r).toBeGreaterThan(0)
      expect(r).toBeLessThan(1)
    }
  })
})

describe('pricing elasticity', () => {
  const base: Baseline = { basePrice: 10, baseUnits: 100, unitCost: 5, elasticity: -1.2 }

  it('a price cut raises units (elastic demand)', () => {
    const cut = simulatePrice(base, -10)
    expect(cut.units).toBeGreaterThan(base.baseUnits)
    expect(cut.price).toBeCloseTo(9, 5)
  })

  it('a price rise lowers units', () => {
    const rise = simulatePrice(base, 10)
    expect(rise.units).toBeLessThan(base.baseUnits)
  })

  it('baseline (0%) reproduces baseline revenue/profit', () => {
    const flat = simulatePrice(base, 0)
    expect(flat.revenue).toBe(1000)
    expect(flat.profit).toBe(500)
    expect(flat.revenueDeltaPct).toBe(0)
  })

  it('promos compute an effective discount', () => {
    const r = simulatePromo(base, PROMOS[1]) // 20% off
    expect(r.price).toBeCloseTo(8, 5)
    expect(r.units).toBeGreaterThan(base.baseUnits)
  })
})

describe('inventory planning', () => {
  it('computes safety stock, reorder point, EOQ from demand', () => {
    const plan = computeInventoryPlan([
      { stockCode: 'A', description: 'x', category: 'Other', avgDailyDemand: 10, demandStd: 4, unitPrice: 20, unitCost: 10 },
    ])
    const p = plan[0]
    expect(p.safetyStock).toBeGreaterThan(0)
    expect(p.reorderPoint).toBeGreaterThan(p.safetyStock)
    expect(p.eoq).toBeGreaterThan(0)
    expect(p.annualDemand).toBe(3650)
  })

  it('zero-variance demand yields zero safety stock', () => {
    const plan = computeInventoryPlan([
      { stockCode: 'B', description: 'y', category: 'Other', avgDailyDemand: 5, demandStd: 0, unitPrice: 10, unitCost: 5 },
    ])
    expect(plan[0].safetyStock).toBe(0)
  })
})

describe('customers', () => {
  it('segments and projects 12-month value', () => {
    const rows: CustomerRow[] = Array.from({ length: 12 }, (_, i) => ({
      customerId: String(i),
      country: 'United Kingdom',
      recency: 200 - i * 15,
      frequency: i + 1,
      monetary: (i + 1) * 100,
    }))
    const { customers, summary } = computeCustomers(rows, 730)
    expect(customers).toHaveLength(12)
    expect(summary.totalCustomers).toBe(12)
    expect(summary.totalPredictedValue).toBeGreaterThan(0)
    // churn risk is bounded
    for (const c of customers) {
      expect(c.churnRisk).toBeGreaterThanOrEqual(0)
      expect(c.churnRisk).toBeLessThanOrEqual(1)
    }
  })

  it('empty input is safe', () => {
    expect(computeCustomers([], 365).summary.totalCustomers).toBe(0)
  })
})

describe('root cause', () => {
  it('identifies the top drag on a decline', () => {
    const res = assembleRootCause({
      metricLabel: 'Revenue',
      categories: [
        { name: 'Home & Decor', current: 800, prior: 1000 }, // -200 biggest drag
        { name: 'Kitchen & Dining', current: 520, prior: 500 },
        { name: 'Bags & Storage', current: 300, prior: 320 },
      ],
    })
    expect(res.changePct).toBeLessThan(0)
    expect(res.topDrag).toBe('Home & Decor')
    expect(res.recommendations[0]).toContain('Home & Decor')
  })
})

describe('decisions synthesis', () => {
  it('ranks customer value above a low-confidence forecast', () => {
    const recs = buildOperationsDecisions({
      forecast: { projectedTotal: 50000, horizonLabel: 'next 4 weeks', trendPerStep: 100, backtestAccuracy: 0.1, model: 'Linear' },
      customers: { atRiskValue: 200000, atRiskCount: 230, vipValue: 400000, vipCount: 1300 },
      returns: { value: 1530000, ratePct: 7.3 },
      rootCause: null,
    })
    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].priority).toBe(1)
    // The forecast (impact 50k × conf 0.1 = 5k) must NOT outrank larger firm signals.
    expect(recs[0].id).not.toBe('forecast-trend')
  })
})
