import { buildProductDecisions } from '../decisions'
import { rankInitiatives } from '../prioritization'
import { getProductDataset } from '../dataset'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Kpi, KpiGrid, PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { Docket } from '@/ui/components/Docket'

const TAGLINE = 'Ranked product decisions from roadmap, experiments & opportunities.'

export default async function DecisionCenter() {
  const ds = await getProductDataset()
  if (!ds.hasEvents && !ds.hasExperiments && !ds.hasBacklog) {
    return (
      <>
        <PageHeader title="Decision Center" tagline={TAGLINE} />
        <EmptyState domain="product" />
      </>
    )
  }
  const demo = ds.source.kind === 'demo'
  const decisions = buildProductDecisions(ds)
  const d30 = ds.retention.pooled.find((p) => p.offset === 30)?.ratePct ?? null
  const activation = demo
    ? (ds.funnel?.steps.find((s) => s.step === 'Activated')?.conversionFromTop ?? null)
    : (ds.funnel?.overall ?? null)
  const top = ds.initiatives.length ? rankInitiatives('rice', ds.initiatives)[0] : undefined

  return (
    <>
      <PageHeader title="Decision Center" tagline={TAGLINE} />
      {demo && <DemoBanner note={PRODUCT_META.demoNote} />}

      <KpiGrid>
        <Kpi label="Users" value={ds.hasEvents ? ds.userCount.toLocaleString('en-US') : '—'} sub={ds.hasEvents ? undefined : 'import events'} />
        <Kpi label="D30 retention" value={d30 === null ? '—' : `${d30}%`} sub={d30 === null ? 'needs 60 days of data' : 'measured'} />
        <Kpi
          label={demo ? 'Activation' : 'Funnel conversion'}
          value={activation === null ? '—' : `${activation}%`}
          sub={demo ? 'of signups' : ds.funnel ? `${ds.funnel.steps[0].step} → ${ds.funnel.steps.at(-1)!.step}` : 'import events'}
        />
        <Kpi label="Top RICE" value={top ? String(top.rice) : '—'} sub={top?.name ?? 'import a backlog'} />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ranked decisions</CardTitle>
        </CardHeader>
        <CardBody>
          {decisions.length ? (
            <Docket decisions={decisions} />
          ) : (
            <p className="text-sm text-muted">No decision signals yet — import experiment results or a backlog alongside your events.</p>
          )}
        </CardBody>
      </Card>
    </>
  )
}
