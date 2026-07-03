import { NextResponse } from 'next/server'
import { answer, sanitizeQuestion, MAX_QUESTION_LENGTH } from '@/core/advisor'
import { USER_COUNT } from '@/domains/product/generator'
import { buildRetention, buildFunnel } from '@/domains/product/analytics'
import { rankInitiatives } from '@/domains/product/prioritization'
import { getExperiments } from '@/domains/product/experiments'
import { ADVISOR_PERSONA, buildProductContext, PRODUCT_RULES, productFallback, type ProductAdvisorSnapshot } from '@/domains/product/advisor'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const question = sanitizeQuestion((body as { question?: unknown } | null)?.question)
  if (!question) {
    return NextResponse.json({ error: `question required (1–${MAX_QUESTION_LENGTH} chars)` }, { status: 400 })
  }

  const { pooled } = buildRetention()
  const { steps } = buildFunnel()
  let worst = { from: '', to: '', drop: 0 }
  for (let i = 1; i < steps.length; i++) {
    const drop = Math.round((100 - steps[i].conversionFromPrev) * 10) / 10
    if (drop > worst.drop) worst = { from: steps[i - 1].step, to: steps[i].step, drop }
  }
  const top = rankInitiatives('rice')[0]
  const winners = getExperiments().filter((e) => e.stats.verdict === 'winner').map((e) => ({ name: e.name, lift: e.stats.liftPercent }))

  const snap: ProductAdvisorSnapshot = {
    userCount: USER_COUNT,
    retention: pooled,
    funnelWorst: worst,
    topInitiative: { name: top.name, rice: top.rice, tier: top.tier },
    winners,
  }

  const result = await answer<ProductAdvisorSnapshot>({
    persona: ADVISOR_PERSONA,
    question,
    context: buildProductContext(snap),
    ruleContext: snap,
    rules: PRODUCT_RULES,
    fallback: productFallback,
  })

  return NextResponse.json(result)
}
