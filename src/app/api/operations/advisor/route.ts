import { NextResponse } from 'next/server'
import { answer, sanitizeQuestion, MAX_QUESTION_LENGTH } from '@/core/advisor'
import { buildSnapshot } from '@/domains/operations/snapshot'
import { opsSource } from '@/domains/operations/source'
import { ADVISOR_PERSONA, buildOpsContext, OPS_RULES, opsFallback, type OpsSnapshot } from '@/domains/operations/advisor'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const question = sanitizeQuestion((body as { question?: unknown } | null)?.question)
  if (!question) {
    return NextResponse.json({ error: `question required (1–${MAX_QUESTION_LENGTH} chars)` }, { status: 400 })
  }

  const { ws, symbol } = await opsSource()
  const snap = ws ? await buildSnapshot(ws, symbol) : null
  if (!snap) {
    return NextResponse.json({
      text: 'No operations data is loaded for this view yet. Import order lines in the Data Manager (or switch to the sample data) and ask again.',
      source: 'deterministic',
    })
  }

  const ops: OpsSnapshot = {
    currency: snap.currency,
    forecast: {
      projectedTotal: snap.projectedTotal,
      trendPerStep: snap.fc.trendPerStep,
      backtestMape: snap.fc.backtest?.mape ?? null,
      model: snap.fc.model,
    },
    customers: {
      totalPredictedValue: snap.customers.totalPredictedValue,
      atRiskValue: snap.customers.atRiskValue,
      atRiskCount: snap.customers.atRiskCount,
      vipCount: snap.customers.vipCount,
    },
    returns: snap.returns,
    rootCause: {
      summary: snap.rootCause.summary,
      topDriver: snap.rootCause.topDriver,
      topDrag: snap.rootCause.topDrag,
      recommendations: snap.rootCause.recommendations,
    },
    topDecisions: snap.decisions.slice(0, 4).map((d) => ({ title: d.title, expectedResult: d.expectedResult, confidence: d.confidence })),
  }

  const result = await answer<OpsSnapshot>({
    persona: ADVISOR_PERSONA,
    question,
    context: buildOpsContext(ops),
    ruleContext: ops,
    rules: OPS_RULES,
    fallback: opsFallback,
  })

  return NextResponse.json(result)
}
