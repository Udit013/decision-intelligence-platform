import { getMarketDataset } from '../dataset'
import { MARKET_META } from '../config'
import { usdFromMillions } from '../format'
import { Card, CardBody } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const TYPE_LABEL = { blue_ocean: 'Blue Ocean', growth_surge: 'Growth Surge', underserved: 'Underserved', emerging: 'Emerging' } as const

const TAGLINE = 'Auto-discovered blue-ocean, growth-surge, underserved & emerging opportunities.'

export default async function Opportunities() {
  const ds = await getMarketDataset()
  if (!ds.markets.length) {
    return (
      <>
        <PageHeader title="Opportunity Engine" tagline={TAGLINE} />
        <EmptyState domain="market" />
      </>
    )
  }
  const opps = ds.opportunities.slice(0, 24)
  return (
    <>
      <PageHeader title="Opportunity Engine" tagline={TAGLINE} />
      {ds.source.kind === 'demo' && <DemoBanner note={MARKET_META.demoNote} />}
      {!opps.length && (
        <Card>
          <CardBody className="text-sm leading-relaxed text-muted">
            No market met an opportunity rule. Rules look for high GDP growth with low saturation, low internet
            penetration with growth, strong purchasing power with limited competition, or a large, growing population —
            add GDP growth, internet %, population, purchasing power or competitor shares to evaluate more of them.
          </CardBody>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {opps.map((o) => (
          <Card key={o.id}>
            <CardBody>
              <div className="flex items-center justify-between">
                <Badge tone="accent">{TYPE_LABEL[o.type]}</Badge>
                <span className="font-mono text-xs text-muted">score {o.opportunityScore} ~mod</span>
              </div>
              <h3 className="mt-2 font-semibold">{o.title}</h3>
              <p className="mt-1 text-sm text-muted">{o.description}</p>
              <div className="mt-2 flex gap-4 text-xs text-muted">
                <span>Potential {o.marketPotential ? usdFromMillions(o.marketPotential) : '—'} ~mod</span>
                <span>Confidence {o.confidenceScore} ~mod</span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
