import { NextResponse } from 'next/server'
import { answer } from '@/core/advisor'
import { generateMarkets, generateCompetitiveData } from '@/domains/market/generator'
import { generateMarketDecisions } from '@/domains/market/scoring'
import { ADVISOR_PERSONA, buildMarketContext, MARKET_RULES, marketFallback, type MarketAdvisorSnapshot } from '@/domains/market/advisor'

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string }
  if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 })

  const markets = generateMarkets()
  const competitive = generateCompetitiveData()
  const decisions = generateMarketDecisions(markets, competitive)

  const snap: MarketAdvisorSnapshot = {
    marketCount: markets.length,
    topExpand: decisions.filter((d) => d.recommendation === 'Expand').slice(0, 5),
    avoid: decisions.filter((d) => d.recommendation === 'Avoid').slice(0, 5),
    avgOpportunity: Math.round(markets.reduce((s, m) => s + m.opportunityScore, 0) / markets.length),
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
