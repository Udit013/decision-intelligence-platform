import { generateMarkets, generateCompetitiveData } from '../generator'
import { MARKET_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

export default function Competition() {
  const nameMap = new Map(generateMarkets().map((m) => [m.id, m.name]))
  const comp = [...generateCompetitiveData()].sort((a, b) => a.marketSaturation - b.marketSaturation)
  const underserved = comp.slice(0, 12)
  const crowded = [...comp].reverse().slice(0, 12)

  const row = (c: (typeof comp)[0]) => (
    <tr key={c.marketId} className="border-b border-border/50">
      <td className="py-2 font-medium">{nameMap.get(c.marketId)}</td>
      <td className="py-2 text-right tabular-nums">{c.marketSaturation}</td>
      <td className="py-2 text-right tabular-nums">{c.marketConcentration}</td>
      <td className="py-2 text-right tabular-nums">{c.competitorCount}</td>
      <td className="py-2 text-right tabular-nums">{c.competitivePressureScore}</td>
    </tr>
  )
  const head = (
    <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
      <th className="py-2">Market</th>
      <th className="py-2 text-right">Saturation ~mod</th>
      <th className="py-2 text-right">HHI ~mod</th>
      <th className="py-2 text-right">Competitors ~mod</th>
      <th className="py-2 text-right">Pressure ~mod</th>
    </tr>
  )

  return (
    <>
      <PageHeader title="Competitive Intelligence" tagline="Saturation, concentration (HHI), and pressure — surfacing underserved vs crowded markets." />
      <DemoBanner note={MARKET_META.demoNote} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most underserved (low saturation)</CardTitle></CardHeader>
          <CardBody><table className="w-full text-sm"><thead>{head}</thead><tbody>{underserved.map(row)}</tbody></table></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Most crowded (high saturation)</CardTitle></CardHeader>
          <CardBody><table className="w-full text-sm"><thead>{head}</thead><tbody>{crowded.map(row)}</tbody></table></CardBody>
        </Card>
      </div>
    </>
  )
}
