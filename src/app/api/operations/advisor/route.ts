import { NextResponse } from 'next/server'
import { answer } from '@/core/advisor'
import { buildSnapshot } from '@/domains/operations/snapshot'
import { ADVISOR_PERSONA, buildOpsContext, OPS_RULES, opsFallback, type OpsSnapshot } from '@/domains/operations/advisor'

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string }
  if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 })

  const snap = await buildSnapshot()
  if (!snap) {
    return NextResponse.json({
      text: 'No operations data is loaded yet. Run the ETL (scripts/etl-operations.ts) so I can answer from real data.',
      source: 'deterministic',
    })
  }

  const ops: OpsSnapshot = {
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
