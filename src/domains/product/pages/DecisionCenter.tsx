import { buildProductDecisions } from '../decisions'
import { buildRetention, buildFunnel } from '../analytics'
import { rankInitiatives } from '../prioritization'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { Kpi, KpiGrid, PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

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
        <CardHeader><CardTitle>Ranked decisions</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {decisions.map((d) => (
            <div key={d.id} className="rounded-md border border-border bg-surface-2/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">#{d.priority} · {d.category}</span>
                  <h3 className="mt-1 font-semibold">{d.title}</h3>
                </div>
                <Badge tone="accent">{Math.round(d.confidence * 100)}% conf</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{d.recommendation}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="text-[var(--accent)]">→ {d.expectedResult}</span>
                <span className="text-muted">{d.reasoning}</span>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  )
}
