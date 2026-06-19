import { generateMarkets, generateCompetitiveData } from '../generator'
import { generateMarketDecisions, MARKET_DECISION_WEIGHTS } from '../scoring'
import { MARKET_META } from '../config'
import { usdFromBillions, usdFromThousands } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { Kpi, KpiGrid, PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const BUCKET_TONE = { Expand: 'good', Investigate: 'accent', Monitor: 'neutral', Avoid: 'bad' } as const

const CRITERION_LABEL: Record<string, string> = {
  opportunity: 'Opportunity',
  easeOfEntry: 'Ease of entry',
  risk: 'Low risk',
  gdpGrowth: 'Growth',
}

/** The two criteria contributing the most points to this market's composite. */
function topDrivers(contributions: { key: string; weighted: number }[]): string {
  return [...contributions]
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 2)
    .map((c) => `${CRITERION_LABEL[c.key] ?? c.key} +${c.weighted}`)
    .join(' · ')
}

export default function ExpansionCenter() {
  const markets = generateMarkets()
  const competitive = generateCompetitiveData()
  const decisions = generateMarketDecisions(markets, competitive)

  const counts = decisions.reduce<Record<string, number>>((a, d) => ((a[d.recommendation] = (a[d.recommendation] ?? 0) + 1), a), {})
  const avgOpp = Math.round(markets.reduce((s, m) => s + m.opportunityScore, 0) / markets.length)
  const top = decisions.slice(0, 12)

  return (
    <>
      <PageHeader title="Expansion Center" tagline="Markets ranked & classified by the shared scoring engine." />
      <DemoBanner note={MARKET_META.demoNote} />

      <KpiGrid>
        <Kpi label="Markets" value={String(MARKET_META.marketCount)} sub="distinct (dedup'd)" estimate />
        <Kpi label="Expand" value={String(counts.Expand ?? 0)} sub="top tier" estimate />
        <Kpi label="Investigate" value={String(counts.Investigate ?? 0)} estimate />
        <Kpi label="Avg opportunity" value={String(avgOpp)} sub="modeled 0–100" estimate />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Ranked markets</CardTitle>
          <Badge tone="neutral" title="modeled weights">
            weights: opp {MARKET_DECISION_WEIGHTS.opportunity} · ease {MARKET_DECISION_WEIGHTS.easeOfEntry} · risk {MARKET_DECISION_WEIGHTS.risk} · growth {MARKET_DECISION_WEIGHTS.gdpGrowth}
          </Badge>
        </CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">#</th>
                <th className="py-2">Market</th>
                <th className="py-2 text-right">Score ~mod</th>
                <th className="py-2 text-center">Call</th>
                <th className="py-2 text-right">Opp</th>
                <th className="py-2 text-right">Risk</th>
                <th className="py-2 text-right">ROI ~mod</th>
                <th className="py-2 text-right">Invest ~mod</th>
              </tr>
            </thead>
            <tbody>
              {top.map((d) => (
                <tr key={d.marketId} className="border-b border-border/50">
                  <td className="py-2 align-top text-muted">{d.rank}</td>
                  <td className="py-2">
                    <span className="font-medium">{d.marketName}</span>
                    <p className="font-mono text-[10px] text-muted" title="Top contributing criteria to the composite score (from core/scoreAndClassify)">
                      ▲ {topDrivers(d.contributions)}
                    </p>
                  </td>
                  <td className="py-2 align-top text-right tabular-nums">{d.score}</td>
                  <td className="py-2 align-top text-center">
                    <Badge tone={BUCKET_TONE[d.recommendation]}>{d.recommendation}</Badge>
                  </td>
                  <td className="py-2 align-top text-right tabular-nums">{d.opportunityScore}</td>
                  <td className="py-2 align-top text-right tabular-nums">{d.riskScore}</td>
                  <td className="py-2 align-top text-right tabular-nums">{d.expectedRoi}x</td>
                  <td className="py-2 align-top text-right tabular-nums">{usdFromThousands(d.investmentRequired)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            Buckets via <code className="font-mono">core/scoreAndClassify()</code> — the same primitive Operations uses.
            Largest market shown: {usdFromBillions(Math.max(...markets.map((m) => m.gdp)))} GDP.
          </p>
        </CardBody>
      </Card>
    </>
  )
}
