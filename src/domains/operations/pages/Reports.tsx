import type { ReportDoc } from '@/core/report'
import { buildSnapshot } from '../snapshot'
import { OPERATIONS_META, MEASURED_FORECAST_ACCURACY } from '../config'
import { gbp } from '../format'
import { ReportButton } from './ReportButton'
import { Card, CardBody } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'

export default async function Reports() {
  const snap = await buildSnapshot()
  if (!snap) {
    return (
      <>
        <PageHeader title="Executive Reports" tagline="Board-ready PDF of KPIs and ranked decisions." />
        <EmptyState />
      </>
    )
  }
  const { kpis, decisions, customers, returns } = snap

  const doc: ReportDoc = {
    brand: OPERATIONS_META.brand,
    title: OPERATIONS_META.reportTitle,
    subtitle: `Real data: UCI Online Retail II (${kpis.dateMin} → ${kpis.dateMax}). ${MEASURED_FORECAST_ACCURACY.note}`,
    period: 'summary',
    accent: OPERATIONS_META.accentRgb,
    dataNote: OPERATIONS_META.dataNote,
    sections: [
      {
        kind: 'kpis',
        title: 'Headline KPIs',
        items: [
          { label: 'Revenue', value: gbp(kpis.revenue) },
          { label: 'Orders', value: kpis.orders.toLocaleString(), delta: `AOV ${gbp(kpis.aov)}` },
          { label: 'Customers', value: kpis.customers.toLocaleString() },
          { label: 'Returns', value: `${returns.ratePct}%`, delta: gbp(returns.value) },
          { label: 'At-risk value', value: gbp(customers.atRiskValue), delta: `${customers.atRiskCount} customers` },
          { label: 'VIP value', value: gbp(customers.vipValue), delta: `${customers.vipCount} VIPs` },
        ],
      },
      {
        kind: 'recommendations',
        title: 'Ranked Decisions',
        items: decisions.map((d) => ({
          title: d.title,
          expectedResult: d.expectedResult,
          confidence: d.confidence,
          recommendation: d.recommendation,
        })),
      },
      {
        kind: 'bullets',
        title: 'Forecast accuracy (honest, out-of-sample)',
        items: [
          `Weekly 1-step: MAPE ${MEASURED_FORECAST_ACCURACY.weekly1Step.mape}%, R² ${MEASURED_FORECAST_ACCURACY.weekly1Step.r2}.`,
          `Weekly 4-step: MAPE ${MEASURED_FORECAST_ACCURACY.weekly4Step.mape}%, R² ${MEASURED_FORECAST_ACCURACY.weekly4Step.r2}.`,
          'Forecast is directional only on this spiky series; plan against the prediction interval.',
        ],
      },
    ],
  }

  return (
    <>
      <PageHeader title="Executive Reports" tagline="Board-ready PDF of KPIs and ranked decisions — generated from real data." />
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">One-click executive summary: KPIs, ranked decisions, and honest forecast accuracy.</p>
            <p className="mt-1 text-xs text-muted">{OPERATIONS_META.dataNote}</p>
          </div>
          <ReportButton doc={doc} />
        </CardBody>
      </Card>
    </>
  )
}
