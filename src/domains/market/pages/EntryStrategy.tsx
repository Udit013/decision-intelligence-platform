import { generateMarkets, generateCompetitiveData } from '../generator'
import { generateMarketDecisions, generateEntryStrategies, computeRiskProfile } from '../scoring'
import { MARKET_META } from '../config'
import { usdFromThousands } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

export default function EntryStrategy() {
  const markets = generateMarkets()
  const competitive = generateCompetitiveData()
  const decisions = generateMarketDecisions(markets, competitive)
  const topId = decisions[0].marketId
  const market = markets.find((m) => m.id === topId)!
  const comp = competitive.find((c) => c.marketId === topId)!
  const strategies = generateEntryStrategies(market, comp)
  const risk = computeRiskProfile(market, comp)

  const riskDims: [string, number][] = [
    ['Economic', risk.economic], ['Competitive', risk.competitive], ['Regulatory', risk.regulatory], ['Operational', risk.operational], ['Market', risk.market],
  ]

  return (
    <>
      <PageHeader title="Entry Strategy" tagline={`Ranked entry routes for the top market — ${market.name}.`} />
      <DemoBanner note={MARKET_META.demoNote} />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Entry strategies for {market.name} — ranked by core/scoreAndClassify</CardTitle>
          <Badge tone="bad">overall risk {risk.overall} ~mod</Badge>
        </CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">#</th>
                <th className="py-2">Strategy</th>
                <th className="py-2 text-right">Cost ~mod</th>
                <th className="py-2 text-right">Risk ~mod</th>
                <th className="py-2 text-right">Time</th>
                <th className="py-2 text-right">ROI ~mod</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s) => (
                <tr key={s.strategy} className="border-b border-border/50">
                  <td className="py-2 text-muted">{s.rank}</td>
                  <td className="py-2"><span className="font-medium">{s.name}</span><p className="text-xs text-muted">{s.description}</p></td>
                  <td className="py-2 text-right tabular-nums">{usdFromThousands(s.cost)}</td>
                  <td className="py-2 text-right tabular-nums">{s.risk}</td>
                  <td className="py-2 text-right tabular-nums">{s.timeToMarket}mo</td>
                  <td className="py-2 text-right tabular-nums">{s.expectedRoi}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Risk profile (modeled, 5-dimension)</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {riskDims.map(([label, v]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-28 text-sm text-muted">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${v}%` }} />
              </div>
              <span className="w-8 text-right text-sm tabular-nums">{v}</span>
            </div>
          ))}
          {risk.mitigations.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Mitigations</p>
              {risk.mitigations.map((m, i) => <p key={i} className="mt-1 text-sm text-muted">• {m}</p>)}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}
