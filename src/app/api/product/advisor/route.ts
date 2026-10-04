import { NextResponse } from 'next/server'
import { answer, sanitizeQuestion, MAX_QUESTION_LENGTH } from '@/core/advisor'
import { getProductDataset } from '@/domains/product/dataset'
import { rankInitiatives } from '@/domains/product/prioritization'
import { ADVISOR_PERSONA, buildProductContext, PRODUCT_RULES, productFallback, type ProductAdvisorSnapshot } from '@/domains/product/advisor'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const question = sanitizeQuestion((body as { question?: unknown } | null)?.question)
  if (!question) {
    return NextResponse.json({ error: `question required (1–${MAX_QUESTION_LENGTH} chars)` }, { status: 400 })
  }

  const ds = await getProductDataset()
  if (!ds.hasEvents && !ds.hasExperiments && !ds.hasBacklog) {
    return NextResponse.json({
      text: 'No product data is loaded for this view yet. Import events, experiment results or a backlog in the Data Manager (or switch to the sample data) and ask again.',
      source: 'deterministic',
    })
  }
  const steps = ds.funnel?.steps ?? []
  let worst = { from: '', to: '', drop: 0 }
  for (let i = 1; i < steps.length; i++) {
    const drop = Math.round((100 - steps[i].conversionFromPrev) * 10) / 10
    if (drop > worst.drop) worst = { from: steps[i - 1].step, to: steps[i].step, drop }
  }
  const top = ds.initiatives.length ? rankInitiatives('rice', ds.initiatives)[0] : null
  const winners = ds.experiments.filter((e) => e.stats.verdict === 'winner').map((e) => ({ name: e.name, lift: e.stats.liftPercent }))

  const snap: ProductAdvisorSnapshot = {
    demo: ds.source.kind === 'demo',
    userCount: ds.userCount,
    retention: ds.retention.pooled,
    funnelWorst: worst,
    topInitiative: top ? { name: top.name, rice: top.rice, tier: top.tier } : null,
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
