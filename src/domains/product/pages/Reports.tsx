import type { ReportDoc } from '@/core/report'
import { buildProductDecisions } from '../decisions'
import { getProductDataset } from '../dataset'
import { PRODUCT_META } from '../config'
import { Card, CardBody } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { ReportButton } from '@/ui/components/ReportButton'

export default async function Reports() {
  const ds = await getProductDataset()
  if (!ds.hasEvents && !ds.hasExperiments && !ds.hasBacklog) {
    return (
      <>
        <PageHeader title="Executive Reports" tagline="Board-ready PDF of engagement KPIs and ranked product decisions." />
        <EmptyState domain="product" />
      </>
    )
  }
  const demo = ds.source.kind === 'demo'
  const decisions = buildProductDecisions(ds)
  const winners = ds.experiments.filter((e) => e.stats.verdict === 'winner')
  const r = (o: number) => {
    const v = ds.retention.pooled.find((p) => p.offset === o)?.ratePct
    return v === null || v === undefined ? '—' : `${v}%`
  }
  const activation = demo ? ds.funnel?.steps.find((s) => s.step === 'Activated')?.conversionFromTop : ds.funnel?.overall
  const note = demo ? PRODUCT_META.demoNote : 'Your imported product events, experiment results and backlog. Retention uses bracketed, censoring-aware windows.'

  const doc: ReportDoc = {
    brand: PRODUCT_META.brand,
    title: PRODUCT_META.reportTitle,
    subtitle: note,
    period: 'summary',
    accent: PRODUCT_META.accentRgb,
    dataNote: note,
    sections: [
      {
        kind: 'kpis',
        title: 'Engagement (measured)',
        items: [
          { label: 'Users', value: ds.userCount.toLocaleString('en-US') },
          { label: demo ? 'Activation' : 'Funnel conversion', value: activation === undefined ? '—' : `${activation}%` },
          { label: 'D1', value: r(1) },
          { label: 'D7', value: r(7) },
          { label: 'D30', value: r(30) },
          { label: 'D90', value: r(90) },
        ],
      },
      { kind: 'recommendations', title: 'Ranked Decisions', items: decisions.map((d) => ({ title: d.title, expectedResult: d.expectedResult, confidence: d.confidence, recommendation: d.recommendation })) },
      { kind: 'bullets', title: 'Experiments & method', items: [
          ds.experiments.length ? `${winners.length} of ${ds.experiments.length} experiment comparisons reached significance (core/stats two-proportion z-test).` : 'No experiment results imported.',
          demo ? 'Retention D1–D90 measured from the synthetic data via core/cohort — not hardcoded.' : ds.retention.definition,
          'RICE/ICE/WSJF tiered via core/scoreAndClassify.',
        ] },
    ],
  }

  return (
    <>
      <PageHeader title="Executive Reports" tagline="Board-ready PDF of engagement KPIs and ranked product decisions." />
      {demo && <DemoBanner note={PRODUCT_META.demoNote} />}
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <p className="text-sm">Executive summary: measured retention/funnel, ranked decisions, and experiment outcomes.</p>
          <ReportButton doc={doc} filename="product-executive-report.pdf" />
        </CardBody>
      </Card>
    </>
  )
}
