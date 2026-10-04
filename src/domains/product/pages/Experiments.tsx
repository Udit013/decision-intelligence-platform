import { getProductDataset } from '../dataset'
import { PRODUCT_META } from '../config'
import { Card, CardBody } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { MissingData } from '@/ui/components/MissingData'

const TONE = { winner: 'good', loser: 'bad', inconclusive: 'neutral' } as const

export default async function Experiments() {
  const ds = await getProductDataset()
  const experiments = ds.experiments
  return (
    <>
      <PageHeader title="Experiments" tagline="A/B significance via the shared core/stats engine — honest verdicts, not all wins." />
      {ds.source.kind === 'demo' && <DemoBanner note={PRODUCT_META.demoNote} />}
      {!experiments.length && (
        <MissingData kind="product.experiments" why="Significance testing needs users and conversions per variant (at least two variants per experiment)." />
      )}
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
