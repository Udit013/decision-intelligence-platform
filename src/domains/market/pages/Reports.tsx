import type { ReportDoc } from '@/core/report'
import { getMarketDataset } from '../dataset'
import { generateMarketDecisions } from '../scoring'
import { MARKET_META } from '../config'
import { usdFromThousands, num } from '../format'
import { Card, CardBody } from '@/ui/components/Card'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { ReportButton } from '@/ui/components/ReportButton'

export default async function Reports() {
  const ds = await getMarketDataset()
  if (!ds.markets.length) {
    return (
      <>
        <PageHeader title="Boardroom Reports" tagline="Board-ready PDF of the expansion portfolio." />
        <EmptyState domain="market" />
      </>
    )
  }
  const demo = ds.source.kind === 'demo'
  const { markets, competitive } = ds
  const decisions = generateMarketDecisions(markets, competitive)
  const expand = decisions.filter((d) => d.recommendation === 'Expand')
  const opps = markets.map((m) => m.opportunityScore).filter((v): v is number => v !== null)
  const avgOpp = opps.length ? Math.round(opps.reduce((s, v) => s + v, 0) / opps.length) : null
  const note = demo
    ? MARKET_META.demoNote
    : `Your imported market indicators${ds.hasCompetition ? ' and competitor shares' : ''}. Scores are modeled from editorial weights over the indicators provided.`

  const doc: ReportDoc = {
    brand: MARKET_META.brand,
    title: MARKET_META.reportTitle,
    subtitle: note,
    period: 'summary',
    accent: MARKET_META.accentRgb,
    dataNote: note,
    sections: [
      {
        kind: 'kpis',
        title: 'Portfolio (modeled)',
        items: [
          { label: 'Markets', value: String(markets.length) },
          { label: 'Expand', value: String(expand.length) },
          { label: 'Avg opportunity', value: num(avgOpp) },
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
      {
        kind: 'bullets',
        title: 'Method & caveats',
        items: demo
          ? ['All scores are modeled from editorial weights over synthetic data — no validated accuracy.', 'Expand/Investigate/Monitor/Avoid via the shared core/scoreAndClassify primitive.', `${markets.length} distinct markets (old README’s "121" included a duplicate).`]
          : ['Scores are modeled from editorial weights over the indicators you provided; missing indicators are skipped, never imputed.', 'Expand/Investigate/Monitor/Avoid via the shared core/scoreAndClassify primitive.', `${markets.length} markets from your imports.`],
      },
    ],
  }

  return (
    <>
      <PageHeader title="Boardroom Reports" tagline="Board-ready PDF of the modeled expansion portfolio." />
      {demo && <DemoBanner note={MARKET_META.demoNote} />}
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <p className="text-sm">Executive summary: portfolio KPIs and top expansion targets — clearly labeled as {demo ? 'modeled sample data' : 'modeled from your data'}.</p>
          <ReportButton doc={doc} filename="market-boardroom-report.pdf" />
        </CardBody>
      </Card>
    </>
  )
}
