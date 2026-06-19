import { getExperiments } from '../experiments'
import { PRODUCT_META } from '../config'
import { Card, CardBody } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const TONE = { winner: 'good', loser: 'bad', inconclusive: 'neutral' } as const

export default function Experiments() {
  const experiments = getExperiments()
  return (
    <>
      <PageHeader title="Experiments" tagline="A/B significance via the shared core/stats engine — honest verdicts, not all wins." />
      <DemoBanner note={PRODUCT_META.demoNote} />
      <div className="space-y-3">
        {experiments.map((e) => (
          <Card key={e.name}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{e.name}</h3>
                  <p className="text-sm text-muted">{e.hypothesis}</p>
                </div>
                <Badge tone={TONE[e.stats.verdict]}>{e.stats.verdict}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                <span className="text-muted">Control: <span className="text-fg tabular-nums">{(e.stats.controlRate * 100).toFixed(1)}%</span></span>
                <span className="text-muted">Treatment: <span className="text-fg tabular-nums">{(e.stats.treatmentRate * 100).toFixed(1)}%</span></span>
                <span className="text-muted">Lift: <span className={`tabular-nums ${e.stats.liftPercent >= 0 ? 'text-good' : 'text-bad'}`}>{e.stats.liftPercent >= 0 ? '+' : ''}{e.stats.liftPercent.toFixed(1)}%</span></span>
                <span className="text-muted">p-value: <span className="text-fg tabular-nums">{e.stats.pValue.toFixed(4)}</span></span>
              </div>
              <p className="mt-2 text-xs text-muted">95% CI on lift: [{(e.stats.confidenceInterval[0] * 100).toFixed(2)}%, {(e.stats.confidenceInterval[1] * 100).toFixed(2)}%] · need ~{e.stats.requiredSamplePerArm.toLocaleString()}/arm for MDE</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
