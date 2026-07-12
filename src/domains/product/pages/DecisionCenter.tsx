import { buildProductDecisions } from '../decisions'
import { buildRetention, buildFunnel } from '../analytics'
import { rankInitiatives } from '../prioritization'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Kpi, KpiGrid, PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { Docket } from '@/ui/components/Docket'

export default function DecisionCenter() {
  const decisions = buildProductDecisions()
  const d30 = buildRetention().pooled.find((p) => p.offset === 30)?.ratePct ?? 0
  const activation = buildFunnel().steps.find((s) => s.step === 'Activated')?.conversionFromTop ?? 0
  const top = rankInitiatives('rice')[0]

  return (
    <>
      <PageHeader title="Decision Center" tagline="Ranked product decisions from roadmap, experiments & opportunities." />
      <DemoBanner note={PRODUCT_META.demoNote} />

      <KpiGrid>
        <Kpi label="Users" value={PRODUCT_META.userCount.toLocaleString()} />
        <Kpi label="D30 retention" value={`${d30}%`} sub="measured" />
        <Kpi label="Activation" value={`${activation}%`} sub="of signups" />
        <Kpi label="Top RICE" value={top ? String(top.rice) : '—'} sub={top?.name} />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ranked decisions</CardTitle>
        </CardHeader>
        <CardBody>
          <Docket decisions={decisions} />
        </CardBody>
      </Card>
    </>
  )
}
