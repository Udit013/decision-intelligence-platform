import { getCustomerRows, getKpis } from '../data'
import { computeCustomers } from '../customers'
import { gbp } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Kpi, KpiGrid, PageHeader, EmptyState } from '@/ui/components/Kpi'

export default async function Customers() {
  let summary = null
  try {
    const kpis = await getKpis()
    if (kpis.orders) {
      const rows = await getCustomerRows()
      summary = computeCustomers(rows, kpis.observedDays).summary
    }
  } catch {
    summary = null
  }
  if (!summary) {
    return (
      <>
        <PageHeader title="Customer Intelligence" tagline="RFM segmentation, predicted value, and churn risk." />
        <EmptyState />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Customer Intelligence" tagline="RFM segmentation, predicted 12-month value, and churn risk — all from real customer behavior." />
      <KpiGrid>
        <Kpi label="Customers" value={summary.totalCustomers.toLocaleString()} />
        <Kpi label="Predicted 12-mo value" value={gbp(summary.totalPredictedValue)} />
        <Kpi label="At-risk value" value={gbp(summary.atRiskValue)} sub={`${summary.atRiskCount} customers`} />
        <Kpi label="VIP value" value={gbp(summary.vipValue)} sub={`${summary.vipCount} VIPs`} />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader><CardTitle>RFM segments</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">Segment</th>
                <th className="py-2 text-right">Customers</th>
                <th className="py-2 text-right">Revenue (real)</th>
                <th className="py-2 text-right">Predicted 12-mo</th>
              </tr>
            </thead>
            <tbody>
              {summary.segments.map((s) => (
                <tr key={s.segment} className="border-b border-border/50">
                  <td className="py-2 font-medium">{s.segment}</td>
                  <td className="py-2 text-right tabular-nums">{s.count.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{gbp(s.value)}</td>
                  <td className="py-2 text-right tabular-nums">{gbp(s.predicted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  )
}
