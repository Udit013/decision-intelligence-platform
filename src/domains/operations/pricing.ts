/**
 * Pricing & promotion scenario modeling — constant price-elasticity of demand.
 * Ported from retail's pricing engine. Pure functions over a baseline.
 *
 * newUnits = baseUnits · (newPrice/basePrice)^elasticity · promoLift
 * (elasticity is negative; a price cut raises demand). Elasticity values and the
 * cost ratio are ASSUMPTIONS (the dataset has no cost or elasticity); results are
 * labeled "estimated" in the UI.
 */
import type { OperationsCategory } from './assumptions'

export interface Baseline {
  basePrice: number
  baseUnits: number
  /** unit cost (estimated = price × assumed cost ratio) */
  unitCost: number
  /** price elasticity of demand (negative) */
  elasticity: number
}

export interface ScenarioResult {
  label: string
  price: number
  units: number
  revenue: number
  profit: number
  marginPct: number
  revenueDeltaPct: number
  profitDeltaPct: number
}

/** Assumed category elasticities (negative). Editorial estimates, not measured. */
export const CATEGORY_ELASTICITY: Record<OperationsCategory, number> = {
  'Kitchen & Dining': -1.1,
  'Home & Decor': -1.3,
  'Bags & Storage': -1.2,
  'Stationery & Craft': -0.9,
  'Party & Seasonal': -1.6,
  'Garden & Outdoor': -1.0,
  'Toys & Games': -1.4,
  'Jewellery & Accessories': -1.5,
  Other: -1.2,
}

function evaluate(base: Baseline, label: string, price: number, demandMult: number): ScenarioResult {
  const units = base.baseUnits * demandMult
  const revenue = price * units
  const profit = (price - base.unitCost) * units
  const baseRevenue = base.basePrice * base.baseUnits
  const baseProfit = (base.basePrice - base.unitCost) * base.baseUnits
  return {
    label,
    price: Math.round(price * 100) / 100,
    units: Math.round(units),
    revenue: Math.round(revenue),
    profit: Math.round(profit),
    marginPct: revenue > 0 ? Math.round(((price - base.unitCost) / price) * 1000) / 10 : 0,
    revenueDeltaPct: baseRevenue > 0 ? Math.round(((revenue - baseRevenue) / baseRevenue) * 1000) / 10 : 0,
    profitDeltaPct: baseProfit !== 0 ? Math.round(((profit - baseProfit) / Math.abs(baseProfit)) * 1000) / 10 : 0,
  }
}

/** Simulate a price change of `pricePct` (e.g. -10 for a 10% cut). */
export function simulatePrice(base: Baseline, pricePct: number): ScenarioResult {
  const ratio = 1 + pricePct / 100
  const demandMult = Math.pow(Math.max(0.01, ratio), base.elasticity)
  return evaluate(base, `${pricePct >= 0 ? '+' : ''}${pricePct}% price`, base.basePrice * ratio, demandMult)
}

export interface PromoType {
  label: string
  /** effective price ratio (e.g. 0.8 = 20% off) */
  priceRatio: number
  /** extra demand multiplier from the promo beyond elasticity */
  lift: number
}

export const PROMOS: PromoType[] = [
  { label: '10% off', priceRatio: 0.9, lift: 1.15 },
  { label: '20% off', priceRatio: 0.8, lift: 1.35 },
  { label: 'BOGO (eff. 50% off)', priceRatio: 0.5, lift: 1.8 },
  { label: 'Free shipping (eff. 5% off)', priceRatio: 0.95, lift: 1.1 },
]

/** Simulate a promotion: elasticity response × promo lift. */
export function simulatePromo(base: Baseline, promo: PromoType): ScenarioResult {
  const demandMult = Math.pow(Math.max(0.01, promo.priceRatio), base.elasticity) * promo.lift
  return evaluate(base, promo.label, base.basePrice * promo.priceRatio, demandMult)
}
