import { NextResponse } from 'next/server'
import { answer, sanitizeQuestion, MAX_QUESTION_LENGTH } from '@/core/advisor'
import { getMarketDataset } from '@/domains/market/dataset'
import { generateMarketDecisions } from '@/domains/market/scoring'
import { ADVISOR_PERSONA, buildMarketContext, MARKET_RULES, marketFallback, type MarketAdvisorSnapshot } from '@/domains/market/advisor'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const question = sanitizeQuestion((body as { question?: unknown } | null)?.question)
  if (!question) {
    return NextResponse.json({ error: `question required (1–${MAX_QUESTION_LENGTH} chars)` }, { status: 400 })
  }

  const { markets, competitive } = await getMarketDataset()
  if (!markets.length) {
    return NextResponse.json({
      text: 'No market data is loaded for this view yet. Import market indicators in the Data Manager (or switch to the sample data) and ask again.',
      source: 'deterministic',
    })
  }
  const decisions = generateMarketDecisions(markets, competitive)
  const opps = markets.map((m) => m.opportunityScore).filter((v): v is number => v !== null)

  const snap: MarketAdvisorSnapshot = {
    marketCount: markets.length,
    topExpand: decisions.filter((d) => d.recommendation === 'Expand').slice(0, 5),
    avoid: decisions.filter((d) => d.recommendation === 'Avoid').slice(0, 5),
    avgOpportunity: opps.length ? Math.round(opps.reduce((s, v) => s + v, 0) / opps.length) : 0,
  }

  const result = await answer<MarketAdvisorSnapshot>({
    persona: ADVISOR_PERSONA,
    question,
    context: buildMarketContext(snap),
    ruleContext: snap,
    rules: MARKET_RULES,
    fallback: marketFallback,
  })

  return NextResponse.json(result)
}
