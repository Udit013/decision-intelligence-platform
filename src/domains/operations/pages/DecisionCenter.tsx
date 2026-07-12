import { buildSnapshot } from '../snapshot'
import { gbp } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { Kpi, KpiGrid, PageHeader, EmptyState } from '@/ui/components/Kpi'
import { Docket } from '@/ui/components/Docket'

export default async function DecisionCenter() {
  const snap = await buildSnapshot()
  if (!snap) {
    return (
      <>
        <PageHeader title="Decision Center" tagline="Ranked operations decisions synthesized from every engine." />
        <EmptyState />
      </>
    )
  }

  const { kpis, decisions, returns, fc, backtestAccuracy } = snap

  return (
    <>
      <PageHeader
        title="Decision Center"
        tagline="Ranked operations decisions synthesized from forecast, customers, returns & root-cause."
      />

      <KpiGrid>
        <Kpi label="Revenue" value={gbp(kpis.revenue)} sub={`${kpis.dateMin} → ${kpis.dateMax}`} />
        <Kpi label="Orders" value={kpis.orders.toLocaleString()} sub={`AOV ${gbp(kpis.aov)}`} />
        <Kpi label="Customers" value={kpis.customers.toLocaleString()} />
        <Kpi label="Returns" value={`${returns.ratePct}%`} sub={`${gbp(returns.value)} of gross`} />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Ranked decisions</CardTitle>
          <Badge tone={backtestAccuracy < 0.4 ? 'warn' : 'good'}>
            forecast accuracy {Math.round(backtestAccuracy * 100)}% · out-of-sample
          </Badge>
        </CardHeader>
        <CardBody>
          <Docket decisions={decisions} />
        </CardBody>
      </Card>

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
        Forecast model: {fc.model}. Predicted revenue and forecast-derived decisions are directional —
        measured out-of-sample accuracy on this spiky real series is low (R² ≈ 0). Customer and returns
        figures use real data; margin/profit anywhere are estimates.
      </p>
    </>
  )
}
