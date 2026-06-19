import { getDemandRows } from '../data'
import { simulatePrice, simulatePromo, PROMOS, CATEGORY_ELASTICITY, type Baseline } from '../pricing'
import type { OperationsCategory } from '../assumptions'
import { COST_ASSUMPTION_NOTE } from '../assumptions'
import { gbp } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'

function ScenarioTable({ base }: { base: Baseline }) {
  const rows = [
    simulatePrice(base, -20),
    simulatePrice(base, -10),
    simulatePrice(base, 0),
    simulatePrice(base, 10),
    simulatePrice(base, 20),
    ...PROMOS.map((p) => simulatePromo(base, p)),
  ]
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
          <th className="py-2">Scenario</th>
          <th className="py-2 text-right">Price</th>
          <th className="py-2 text-right">Units ~est</th>
          <th className="py-2 text-right">Revenue ~est</th>
          <th className="py-2 text-right">Profit ~est</th>
          <th className="py-2 text-right">Δ Profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-border/50">
            <td className="py-2">{r.label}</td>
            <td className="py-2 text-right tabular-nums">{gbp(r.price)}</td>
            <td className="py-2 text-right tabular-nums">{r.units.toLocaleString()}</td>
            <td className="py-2 text-right tabular-nums">{gbp(r.revenue)}</td>
            <td className="py-2 text-right tabular-nums">{gbp(r.profit)}</td>
            <td className={`py-2 text-right tabular-nums ${r.profitDeltaPct >= 0 ? 'text-good' : 'text-bad'}`}>
              {r.profitDeltaPct >= 0 ? '+' : ''}{r.profitDeltaPct}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default async function Pricing() {
  let top = null
  try {
    const rows = await getDemandRows(20)
    top = rows[0] ?? null
  } catch {
    top = null
  }
  if (!top) {
    return (
      <>
        <PageHeader title="Pricing & Promo" tagline="Elasticity scenario modeling." />
        <EmptyState />
      </>
    )
  }

  const elasticity = CATEGORY_ELASTICITY[top.category as OperationsCategory] ?? -1.2
  const base: Baseline = {
    basePrice: top.unitPrice,
    baseUnits: Math.max(1, Math.round(top.avgDailyDemand * 30)), // monthly baseline units
    unitCost: top.unitCost,
    elasticity,
  }

  return (
    <>
      <PageHeader title="Pricing & Promo" tagline="Constant-elasticity scenario modeling on your highest-velocity product." />

      <div className="mb-4 rounded-md border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
        <strong>Estimated.</strong> Elasticity ({elasticity}) is an assumed category value and {COST_ASSUMPTION_NOTE.toLowerCase()}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{top.description ?? top.stockCode} · {top.category}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-xs text-muted">
            Baseline: price {gbp(base.basePrice)}, ~{base.baseUnits.toLocaleString()} units/mo, est. unit cost {gbp(base.unitCost)}.
          </p>
          <ScenarioTable base={base} />
        </CardBody>
      </Card>
    </>
  )
}
