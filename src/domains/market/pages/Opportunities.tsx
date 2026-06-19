import { generateOpportunities } from '../generator'
import { MARKET_META } from '../config'
import { usdFromMillions } from '../format'
import { Card, CardBody } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const TYPE_LABEL = { blue_ocean: 'Blue Ocean', growth_surge: 'Growth Surge', underserved: 'Underserved', emerging: 'Emerging' } as const

export default function Opportunities() {
  const opps = generateOpportunities().slice(0, 24)
  return (
    <>
      <PageHeader title="Opportunity Engine" tagline="Auto-discovered blue-ocean, growth-surge, underserved & emerging opportunities." />
      <DemoBanner note={MARKET_META.demoNote} />
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
                <span>Potential {usdFromMillions(o.marketPotential)}</span>
                <span>Confidence {o.confidenceScore} ~mod</span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
