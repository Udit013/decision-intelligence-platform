import type { ReportDoc } from '@/core/report'
import { buildRetention, buildFunnel } from '../analytics'
import { buildProductDecisions } from '../decisions'
import { getExperiments } from '../experiments'
import { PRODUCT_META } from '../config'
import { Card, CardBody } from '@/ui/components/Card'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { ReportButton } from '@/ui/components/ReportButton'

export default function Reports() {
  const { pooled } = buildRetention()
  const funnel = buildFunnel()
  const decisions = buildProductDecisions()
  const winners = getExperiments().filter((e) => e.stats.verdict === 'winner')
  const r = (o: number) => pooled.find((p) => p.offset === o)?.ratePct ?? 0

  const doc: ReportDoc = {
    brand: PRODUCT_META.brand,
    title: PRODUCT_META.reportTitle,
    subtitle: PRODUCT_META.demoNote,
    period: 'summary',
    accent: PRODUCT_META.accentRgb,
    dataNote: PRODUCT_META.demoNote,
    sections: [
      {
        kind: 'kpis',
        title: 'Engagement (measured)',
        items: [
          { label: 'Users', value: PRODUCT_META.userCount.toLocaleString() },
          { label: 'Activation', value: `${funnel.steps.find((s) => s.step === 'Activated')?.conversionFromTop ?? 0}%` },
          { label: 'D1', value: `${r(1)}%` },
          { label: 'D7', value: `${r(7)}%` },
          { label: 'D30', value: `${r(30)}%` },
          { label: 'D90', value: `${r(90)}%` },
        ],
      },
      { kind: 'recommendations', title: 'Ranked Decisions', items: decisions.map((d) => ({ title: d.title, expectedResult: d.expectedResult, confidence: d.confidence, recommendation: d.recommendation })) },
      { kind: 'bullets', title: 'Experiments & method', items: [`${winners.length} of ${getExperiments().length} experiments reached significance (core/stats two-proportion z-test).`, 'Retention D1–D90 measured from the synthetic data via core/cohort — not hardcoded.', 'RICE/ICE/WSJF tiered via core/scoreAndClassify.'] },
    ],
  }

  return (
    <>
      <PageHeader title="Executive Reports" tagline="Board-ready PDF of engagement KPIs and ranked product decisions." />
      <DemoBanner note={PRODUCT_META.demoNote} />
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <p className="text-sm">Executive summary: measured retention/funnel, ranked decisions, and experiment outcomes.</p>
          <ReportButton doc={doc} filename="product-executive-report.pdf" />
        </CardBody>
      </Card>
    </>
  )
}
