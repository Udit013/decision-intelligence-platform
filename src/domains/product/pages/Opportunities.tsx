import { discoverOpportunities } from '../opportunities'
import { getProductDataset } from '../dataset'
import { PRODUCT_META } from '../config'
import { Card, CardBody } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const TAGLINE = 'Signals surfaced from the measured analytics — under-adopted features, funnel leaks, retention risk.'

export default async function Opportunities() {
  const ds = await getProductDataset()
  if (!ds.hasEvents) {
    return (
      <>
        <PageHeader title="Opportunity Engine" tagline={TAGLINE} />
        <EmptyState domain="product" />
      </>
    )
  }
  const opps = discoverOpportunities(ds)
  return (
    <>
      <PageHeader title="Opportunity Engine" tagline={TAGLINE} />
      {ds.source.kind === 'demo' && <DemoBanner note={PRODUCT_META.demoNote} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {opps.map((o) => (
          <Card key={o.id}>
            <CardBody>
              <div className="flex items-center justify-between">
                <Badge tone="accent">{o.type}</Badge>
                <span className="font-mono text-xs text-muted">score {o.score}</span>
              </div>
              <h3 className="mt-2 font-semibold">{o.title}</h3>
              <p className="mt-1 text-sm text-muted">{o.description}</p>
              <p className="mt-2 text-xs text-muted">~{o.affectedUsers.toLocaleString()} users affected</p>
            </CardBody>
          </Card>
        ))}
        {opps.length === 0 && <p className="text-sm text-muted">No notable opportunities surfaced from the current data.</p>}
      </div>
    </>
  )
}
