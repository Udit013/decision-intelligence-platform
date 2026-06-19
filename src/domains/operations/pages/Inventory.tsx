import { getDemandRows } from '../data'
import { computeInventoryPlan, INVENTORY_DEFAULTS } from '../inventory'
import { COST_ASSUMPTION_NOTE } from '../assumptions'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'

export default async function Inventory() {
  let plan = null
  try {
    const rows = await getDemandRows(50)
    if (rows.length) plan = computeInventoryPlan(rows)
  } catch {
    plan = null
  }
  if (!plan) {
    return (
      <>
        <PageHeader title="Inventory Planning" tagline="Demand-based reorder targets." />
        <EmptyState />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Inventory Planning" tagline="Demand-based safety stock, reorder points & EOQ from real sales velocity." />

      <div className="mb-4 rounded-md border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
        <strong>Planning, not live risk.</strong> Online Retail II has no stock levels, so this cannot flag current
        stock-outs — it computes what reorder points <em>should be</em>. EOQ and any cost figure are estimates
        (lead time {INVENTORY_DEFAULTS.leadTimeDays}d, service level {INVENTORY_DEFAULTS.serviceLevel * 100}%).{' '}
        {COST_ASSUMPTION_NOTE}
      </div>

      <Card>
        <CardHeader><CardTitle>Top products by velocity — reorder plan</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Avg/day</th>
                <th className="py-2 text-right">Safety stock ~est</th>
                <th className="py-2 text-right">Reorder pt ~est</th>
                <th className="py-2 text-right">EOQ ~est</th>
              </tr>
            </thead>
            <tbody>
              {plan.slice(0, 25).map((p) => (
                <tr key={p.stockCode} className="border-b border-border/50">
                  <td className="max-w-[220px] truncate py-2" title={p.description ?? ''}>{p.description ?? p.stockCode}</td>
                  <td className="py-2 text-right tabular-nums">{p.avgDailyDemand}</td>
                  <td className="py-2 text-right tabular-nums">{p.safetyStock}</td>
                  <td className="py-2 text-right tabular-nums">{p.reorderPoint}</td>
                  <td className="py-2 text-right tabular-nums">{p.eoq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  )
}
