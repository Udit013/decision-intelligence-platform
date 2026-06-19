import { generateMarkets, generateCompetitiveData } from '../generator'
import { generateMarketDecisions } from '../scoring'
import { MARKET_META } from '../config'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { ScenarioSimulator, type SlimMarket } from './ScenarioSimulator'

export default function Scenarios() {
  const markets = generateMarkets()
  const competitive = generateCompetitiveData()
  const satMap = new Map(competitive.map((c) => [c.marketId, c.marketSaturation]))
  // Order markets by expansion rank so the best candidate is the default.
  const ranked = generateMarketDecisions(markets, competitive)
  const slim: SlimMarket[] = ranked.map((d) => {
    const m = markets.find((x) => x.id === d.marketId)!
    return { id: m.id, name: m.name, gdp: m.gdp, opportunityScore: m.opportunityScore, gdpGrowth: m.gdpGrowth, riskScore: m.riskScore, saturation: satMap.get(m.id) ?? 50 }
  })

  return (
    <>
      <PageHeader title="Scenario Simulator" tagline="Model market entry across budget and pricing — 24-month projection." />
      <DemoBanner note={MARKET_META.demoNote} />
      <ScenarioSimulator markets={slim} />
    </>
  )
}
