import { getMarketDataset } from '../dataset'
import { MARKET_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { Badge } from '@/ui/components/Badge'
import type { CompetitiveData } from '../types'

const TAGLINE = 'Saturation, concentration (HHI), and pressure — surfacing underserved vs crowded markets.'

export default async function Competition() {
  const ds = await getMarketDataset()
  if (!ds.markets.length) {
    return (
      <>
        <PageHeader title="Competitive Intelligence" tagline={TAGLINE} />
        <EmptyState domain="market" />
      </>
    )
  }
  const demo = ds.source.kind === 'demo'
  if (!ds.hasCompetition) {
    return (
      <>
        <PageHeader title="Competitive Intelligence" tagline={TAGLINE} />
        <Card>
          <CardBody className="py-10 text-center">
            <p className="kicker text-[var(--accent)]">Competitor shares needed</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              Your markets are loaded, but concentration and saturation are computed from competitor market shares.
              Import a file with market, competitor and share columns as <strong>Competitor shares</strong>.
            </p>
            <a href="/templates/market-competitors.csv" className="btn-line mt-5">Download template</a>
          </CardBody>
        </Card>
      </>
    )
  }

  const nameMap = new Map(ds.markets.map((m) => [m.id, m.name]))
  const comp = [...ds.competitive].sort((a, b) => a.marketSaturation - b.marketSaturation)
  const underserved = comp.slice(0, 12)
  const crowded = [...comp].reverse().slice(0, 12)
  const tag = demo ? ' ~mod' : ''

  const row = (c: CompetitiveData) => (
    <tr key={c.marketId} className="border-b border-border/50">
      <td className="py-2 font-medium">
        {nameMap.get(c.marketId)}
        {!demo && c.topPlayers[0] && <p className="font-mono text-[10px] text-muted">leader {c.topPlayers[0].name} · {c.topPlayers[0].marketShare}%</p>}
      </td>
      <td className="py-2 pl-4 text-right tabular-nums">{c.marketSaturation}</td>
      <td className="py-2 pl-4 text-right tabular-nums">{c.marketConcentration.toLocaleString('en-US')}</td>
      <td className="py-2 pl-4 text-right tabular-nums">{c.competitorCount}</td>
      <td className="py-2 pl-4 text-right tabular-nums">{c.competitivePressureScore}</td>
    </tr>
  )
  const head = (
    <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
      <th className="py-2">Market</th>
      <th className="py-2 pl-4 text-right">Saturation{tag}</th>
      <th className="py-2 pl-4 text-right">HHI{tag}</th>
      <th className="py-2 pl-4 text-right">Players{tag}</th>
      <th className="py-2 pl-4 text-right">Pressure ~mod</th>
    </tr>
  )

  return (
    <>
      <PageHeader title="Competitive Intelligence" tagline={TAGLINE} />
      {demo ? (
        <DemoBanner note={MARKET_META.demoNote} />
      ) : (
        <p className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge tone="good">measured</Badge> Saturation = share held by the competitors you listed; HHI = Σ share² (0–10,000).
          Pressure is modeled from both.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most underserved (low saturation)</CardTitle></CardHeader>
          <CardBody className="overflow-x-auto"><table className="w-full text-sm"><thead>{head}</thead><tbody>{underserved.map(row)}</tbody></table></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Most crowded (high saturation)</CardTitle></CardHeader>
          <CardBody className="overflow-x-auto"><table className="w-full text-sm"><thead>{head}</thead><tbody>{crowded.map(row)}</tbody></table></CardBody>
        </Card>
      </div>
    </>
  )
}
