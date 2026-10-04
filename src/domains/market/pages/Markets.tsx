import { getMarketDataset } from '../dataset'
import { MARKET_META } from '../config'
import { usdFromBillions, num } from '../format'
import { MarketScatter } from './MarketScatter'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

export default async function Markets() {
  const ds = await getMarketDataset()
  if (!ds.markets.length) {
    return (
      <>
        <PageHeader title="Market Intelligence" tagline="Markets scored on the indicators you provide." />
        <EmptyState domain="market" />
      </>
    )
  }
  const { markets } = ds
  const points = markets
    .filter((m) => m.opportunityScore !== null && m.riskScore !== null)
    .map((m) => ({ name: m.name, opportunity: m.opportunityScore!, risk: m.riskScore!, gdp: m.gdp ?? 0 }))
  const top = [...markets].sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1)).slice(0, 25)
  const partial = markets.filter((m) => m.dataCoverage < 1).length

  return (
    <>
      <PageHeader
        title="Market Intelligence"
        tagline={`${markets.length} market${markets.length === 1 ? '' : 's'} scored on GDP, growth, digital adoption, and purchasing power.`}
      />
      {ds.source.kind === 'demo' && <DemoBanner note={MARKET_META.demoNote} />}

      {points.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Opportunity vs Risk (bubble = GDP) — modeled</CardTitle></CardHeader>
          <CardBody><MarketScatter points={points} /></CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Top markets by modeled opportunity</CardTitle></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                  <th className="py-2">Market</th>
                  <th className="py-2">Region</th>
                  <th className="py-2 text-right">GDP</th>
                  <th className="py-2 text-right">Growth</th>
                  <th className="py-2 text-right">Opp ~mod</th>
                  <th className="py-2 text-right">Risk ~mod</th>
                  <th className="py-2 text-right">Ease ~mod</th>
                </tr>
              </thead>
              <tbody>
                {top.map((m) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-2 font-medium">
                      {m.name}
                      {m.dataCoverage < 1 && (
                        <span className="ml-2 font-mono text-[10px] text-muted" title="Share of scoring inputs this market provided">
                          {Math.round(m.dataCoverage * 100)}% inputs
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-muted">{m.continent ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums">{usdFromBillions(m.gdp)}</td>
                    <td className="py-2 text-right tabular-nums">{num(m.gdpGrowth, '%')}</td>
                    <td className="py-2 text-right tabular-nums">{num(m.opportunityScore)}</td>
                    <td className="py-2 text-right tabular-nums">{num(m.riskScore)}</td>
                    <td className="py-2 text-right tabular-nums">{num(m.easeOfEntry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {partial > 0 && (
            <p className="mt-3 text-xs text-muted">
              {partial} market{partial === 1 ? '' : 's'} supplied only some indicators; their scores use the inputs present
              (weights renormalized), never imputed values.
            </p>
          )}
        </CardBody>
      </Card>
    </>
  )
}
