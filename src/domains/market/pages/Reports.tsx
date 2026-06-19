import type { ReportDoc } from '@/core/report'
import { generateMarkets, generateCompetitiveData } from '../generator'
import { generateMarketDecisions } from '../scoring'
import { MARKET_META } from '../config'
import { usdFromThousands } from '../format'
import { Card, CardBody } from '@/ui/components/Card'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { ReportButton } from '@/ui/components/ReportButton'

export default function Reports() {
  const markets = generateMarkets()
  const competitive = generateCompetitiveData()
  const decisions = generateMarketDecisions(markets, competitive)
  const expand = decisions.filter((d) => d.recommendation === 'Expand')
  const avgOpp = Math.round(markets.reduce((s, m) => s + m.opportunityScore, 0) / markets.length)

  const doc: ReportDoc = {
    brand: MARKET_META.brand,
    title: MARKET_META.reportTitle,
    subtitle: MARKET_META.demoNote,
    period: 'summary',
    accent: MARKET_META.accentRgb,
    dataNote: MARKET_META.demoNote,
    sections: [
      {
        kind: 'kpis',
        title: 'Portfolio (modeled)',
        items: [
          { label: 'Markets', value: String(MARKET_META.marketCount) },
          { label: 'Expand', value: String(expand.length) },
          { label: 'Avg opportunity', value: String(avgOpp) },
        ],
      },
      {
        kind: 'recommendations',
        title: 'Top Expansion Targets (modeled)',
        items: decisions.slice(0, 6).map((d) => ({
          title: `${d.marketName} — ${d.recommendation}`,
          expectedResult: `Composite ${d.score}/100 · modeled ROI ${d.expectedRoi}x · invest ${usdFromThousands(d.investmentRequired)}`,
          confidence: Math.min(1, d.score / 100),
          recommendation: d.reasoning,
        })),
      },
      { kind: 'bullets', title: 'Method & caveats', items: ['All scores are modeled from editorial weights over synthetic data — no validated accuracy.', 'Expand/Investigate/Monitor/Avoid via the shared core/scoreAndClassify primitive.', `${MARKET_META.marketCount} distinct markets (old README’s "121" included a duplicate).`] },
    ],
  }

  return (
    <>
      <PageHeader title="Boardroom Reports" tagline="Board-ready PDF of the modeled expansion portfolio." />
      <DemoBanner note={MARKET_META.demoNote} />
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <p className="text-sm">Executive summary: portfolio KPIs and top expansion targets — clearly labeled as modeled demo data.</p>
          <ReportButton doc={doc} filename="market-boardroom-report.pdf" />
        </CardBody>
      </Card>
    </>
  )
}
