import { rankInitiatives } from '../prioritization'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const TIERS = ['Now', 'Next', 'Later', 'Backlog'] as const
const TONE = { Now: 'good', Next: 'accent', Later: 'neutral', Backlog: 'bad' } as const

export default function Roadmap() {
  const ranked = rankInitiatives('rice')
  return (
    <>
      <PageHeader title="Roadmap" tagline="Initiatives bucketed into Now / Next / Later / Backlog by RICE tier." />
      <DemoBanner note={PRODUCT_META.demoNote} />
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
                    <p className="font-mono text-[10px] text-muted">RICE {i.rice} · {i.effort}wk</p>
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
