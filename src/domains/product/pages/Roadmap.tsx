import { rankInitiatives } from '../prioritization'
import { getProductDataset } from '../dataset'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { MissingData } from '@/ui/components/MissingData'

const TIERS = ['Now', 'Next', 'Later', 'Backlog'] as const
const TONE = { Now: 'good', Next: 'accent', Later: 'neutral', Backlog: 'bad' } as const

export default async function Roadmap() {
  const ds = await getProductDataset()
  const header = <PageHeader title="Roadmap" tagline="Initiatives bucketed into Now / Next / Later / Backlog by RICE tier." />
  if (!ds.initiatives.length) {
    return (
      <>
        {header}
        <MissingData kind="product.backlog" why="The roadmap tiers your backlog by RICE score." />
      </>
    )
  }
  const ranked = rankInitiatives('rice', ds.initiatives)
  return (
    <>
      {header}
      {ds.source.kind === 'demo' && <DemoBanner note={PRODUCT_META.demoNote} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier) => {
          const items = ranked.filter((i) => i.tier === tier)
          return (
            <Card key={tier}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>{tier}</CardTitle>
                <Badge tone={TONE[tier]}>{items.length}</Badge>
              </CardHeader>
              <CardBody className="space-y-2">
                {items.length === 0 && <p className="text-xs text-muted">—</p>}
                {items.map((i) => (
                  <div key={i.name} className="rounded-md border border-border bg-surface-2/50 p-2">
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="font-mono text-[10px] text-muted">RICE {i.rice} · effort {i.effort}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </>
  )
}
