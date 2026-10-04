import type { ReportDoc } from '@/core/report'
import { buildSnapshot } from '../snapshot'
import { opsSource } from '../source'
import { OPERATIONS_META, MEASURED_FORECAST_ACCURACY } from '../config'
import { COST_ASSUMPTION_NOTE } from '../assumptions'
import { ReportButton } from '@/ui/components/ReportButton'
import { Card, CardBody } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'

export default async function Reports() {
  const { src, ws, symbol, money } = await opsSource()
  const isDemo = src.kind === 'demo'
  const snap = ws ? await buildSnapshot(ws, symbol) : null
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
    subtitle: isDemo
      ? `Sample data: UCI Online Retail II (${kpis.dateMin} → ${kpis.dateMax}). ${MEASURED_FORECAST_ACCURACY.note}`
      : `Your imported order lines (${kpis.dateMin} → ${kpis.dateMax}). Amounts are in your file's currency.`,
    period: 'summary',
    accent: OPERATIONS_META.accentRgb,
    dataNote: isDemo ? OPERATIONS_META.dataNote : `Your workspace data. ${COST_ASSUMPTION_NOTE}`,
    sections: [
      {
        kind: 'kpis',
        title: 'Headline KPIs',
        items: [
          { label: 'Revenue', value: money(kpis.revenue) },
          { label: 'Orders', value: kpis.orders.toLocaleString(), delta: `AOV ${money(kpis.aov)}` },
          { label: 'Customers', value: kpis.customers.toLocaleString() },
          { label: 'Returns', value: `${returns.ratePct}%`, delta: money(returns.value) },
          { label: 'At-risk value', value: money(customers.atRiskValue), delta: `${customers.atRiskCount} customers` },
          { label: 'VIP value', value: money(customers.vipValue), delta: `${customers.vipCount} VIPs` },
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
        items: isDemo
          ? [
              `Weekly 1-step: MAPE ${MEASURED_FORECAST_ACCURACY.weekly1Step.mape}%, R² ${MEASURED_FORECAST_ACCURACY.weekly1Step.r2}.`,
              `Weekly 4-step: MAPE ${MEASURED_FORECAST_ACCURACY.weekly4Step.mape}%, R² ${MEASURED_FORECAST_ACCURACY.weekly4Step.r2}.`,
              'Forecast is directional only on this spiky series; plan against the prediction interval.',
            ]
          : [
              snap.fc.backtest
                ? `Holdout backtest (${snap.fc.backtest.periods} weeks): MAPE ${snap.fc.backtest.mape.toFixed(1)}%.`
                : 'Not enough weekly history to backtest the forecast yet.',
              `Model: ${snap.fc.model}. Treat the point forecast as directional; plan against the prediction interval.`,
            ],
      },
    ],
  }

  return (
    <>
      <PageHeader title="Executive Reports" tagline="Board-ready PDF of KPIs and ranked decisions — generated from the data you're viewing." />
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">One-click executive summary: KPIs, ranked decisions, and honest forecast accuracy.</p>
            <p className="mt-1 text-xs text-muted">{OPERATIONS_META.dataNote}</p>
          </div>
          <ReportButton doc={doc} filename="operations-executive-report.pdf" />
        </CardBody>
      </Card>
    </>
  )
}
