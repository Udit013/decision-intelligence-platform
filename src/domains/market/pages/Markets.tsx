import { generateMarkets } from '../generator'
import { MARKET_META } from '../config'
import { usdFromBillions } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { MarketScatter } from './MarketScatter'

export default function Markets() {
  const markets = generateMarkets()
  const points = markets.map((m) => ({ name: m.name, opportunity: m.opportunityScore, risk: m.riskScore, gdp: m.gdp }))
  const top = [...markets].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 25)

  return (
    <>
      <PageHeader title="Market Intelligence" tagline={`${MARKET_META.marketCount} markets scored on GDP, growth, digital adoption, and purchasing power.`} />
      <DemoBanner note={MARKET_META.demoNote} />

      <Card>
        <CardHeader><CardTitle>Opportunity vs Risk (bubble = GDP) — modeled</CardTitle></CardHeader>
        <CardBody><MarketScatter points={points} /></CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Top markets by modeled opportunity</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">Market</th>
                <th className="py-2">Continent</th>
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
                  <td className="py-2 font-medium">{m.name}</td>
                  <td className="py-2 text-muted">{m.continent}</td>
                  <td className="py-2 text-right tabular-nums">{usdFromBillions(m.gdp)}</td>
                  <td className="py-2 text-right tabular-nums">{m.gdpGrowth}%</td>
                  <td className="py-2 text-right tabular-nums">{m.opportunityScore}</td>
                  <td className="py-2 text-right tabular-nums">{m.riskScore}</td>
                  <td className="py-2 text-right tabular-nums">{m.easeOfEntry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  )
}
