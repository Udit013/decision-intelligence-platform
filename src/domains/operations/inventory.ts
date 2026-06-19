/**
 * Inventory PLANNING (not live risk).
 *
 * ⚠️ Online Retail II has NO stock levels and NO cost. So unlike the old retail
 * repo — which read a stock table to flag live stock-out/overstock — this engine
 * can only produce demand-based PLANNING targets: safety stock, reorder point, and
 * EOQ, given assumed lead time / service level / ordering & holding costs. It
 * cannot assess current on-hand risk because that data does not exist. The UI
 * states this explicitly. Every cost figure is an estimate (price × cost ratio).
 */
import { zForConfidence } from '@/core/stats'

export interface DemandRow {
  stockCode: string
  description: string | null
  category: string
  /** mean units sold per day (real) */
  avgDailyDemand: number
  /** std of daily units (real) */
  demandStd: number
  /** average selling price (real) */
  unitPrice: number
  /** estimated unit cost = unitPrice × assumed cost ratio */
  unitCost: number
}

export interface InventoryParams {
  leadTimeDays?: number
  serviceLevel?: number
  /** assumed fixed cost per purchase order */
  orderingCost?: number
  /** assumed annual holding cost as fraction of unit cost */
  holdingCostRate?: number
}

export interface InventoryPlan extends DemandRow {
  safetyStock: number
  reorderPoint: number
  /** economic order quantity (estimated) */
  eoq: number
  annualDemand: number
  /** estimated annual revenue at risk if the item lapses to stock-out */
  annualRevenue: number
}

export const INVENTORY_DEFAULTS: Required<InventoryParams> = {
  leadTimeDays: 7,
  serviceLevel: 0.95,
  orderingCost: 50,
  holdingCostRate: 0.25,
}

/** Compute demand-based planning targets per product (estimates, not live stock). */
export function computeInventoryPlan(rows: DemandRow[], params: InventoryParams = {}): InventoryPlan[] {
  const p = { ...INVENTORY_DEFAULTS, ...params }
  const z = zForConfidence(p.serviceLevel < 1 ? 2 * p.serviceLevel - 1 : 0.9) // one-sided ≈ via two-sided table
  return rows.map((r) => {
    const leadDemand = r.avgDailyDemand * p.leadTimeDays
    const safetyStock = Math.ceil(z * r.demandStd * Math.sqrt(p.leadTimeDays))
    const reorderPoint = Math.ceil(leadDemand + safetyStock)
    const annualDemand = r.avgDailyDemand * 365
    const unitCost = r.unitCost > 0 ? r.unitCost : r.unitPrice * 0.5
    const eoq = Math.ceil(
      Math.sqrt((2 * annualDemand * p.orderingCost) / Math.max(0.01, unitCost * p.holdingCostRate)),
    )
    return {
      ...r,
      safetyStock,
      reorderPoint,
      eoq,
      annualDemand: Math.round(annualDemand),
      annualRevenue: Math.round(annualDemand * r.unitPrice),
    }
  })
}
