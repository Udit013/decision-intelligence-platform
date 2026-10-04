import { getMarketDataset } from '../dataset'
import { generateMarketDecisions } from '../scoring'
import { MARKET_META } from '../config'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { Card, CardBody } from '@/ui/components/Card'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { ScenarioSimulator, type SlimMarket } from './ScenarioSimulator'

const TAGLINE = 'Model market entry across budget and pricing — 24-month projection.'

export default async function Scenarios() {
  const ds = await getMarketDataset()
  if (!ds.markets.length) {
    return (
      <>
        <PageHeader title="Scenario Simulator" tagline={TAGLINE} />
        <EmptyState domain="market" />
      </>
    )
  }
  const satMap = new Map(ds.competitive.map((c) => [c.marketId, c.marketSaturation]))
  // Order markets by expansion rank so the best candidate is the default.
  const ranked = generateMarketDecisions(ds.markets, ds.competitive)
  const byId = new Map(ds.markets.map((m) => [m.id, m]))
  const slim: SlimMarket[] = []
  for (const d of ranked) {
    const m = byId.get(d.marketId)!
    // Revenue scales with GDP and opportunity — markets missing either can't be projected.
    if (m.gdp === null || m.opportunityScore === null) continue
    slim.push({ id: m.id, name: m.name, gdp: m.gdp, opportunityScore: m.opportunityScore, gdpGrowth: m.gdpGrowth, riskScore: m.riskScore, saturation: satMap.get(m.id) ?? null })
  }
  const excluded = ds.markets.length - slim.length

  return (
    <>
      <PageHeader title="Scenario Simulator" tagline={TAGLINE} />
      {ds.source.kind === 'demo' && <DemoBanner note={MARKET_META.demoNote} />}
      {slim.length ? (
        <ScenarioSimulator markets={slim} />
      ) : (
        <Card>
          <CardBody className="text-sm leading-relaxed text-muted">
            Scenario projections scale with a market&apos;s GDP and opportunity score. Add a GDP column (USD billions) to
            your market indicators to model entry scenarios.
          </CardBody>
        </Card>
      )}
      {excluded > 0 && slim.length > 0 && (
        <p className="mt-3 text-xs text-muted">{excluded} market{excluded === 1 ? '' : 's'} without GDP data {excluded === 1 ? 'is' : 'are'} not listed.</p>
      )}
    </>
  )
}
