import { forecast } from '@/core/forecast'
import { walkForwardBacktest, type Forecaster } from '@/core/validation'
import { getRevenueSeries } from '../data'
import { opsSource } from '../source'
import { ForecastChart } from './ForecastChart'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { Kpi, KpiGrid, PageHeader, EmptyState } from '@/ui/components/Kpi'

/** Walk-forward forecaster over the series' own weekly dates. */
const weeklyForecaster =
  (dates: string[]): Forecaster =>
  (train, h) =>
    forecast(train, dates.slice(0, train.length), 'week', h).series.filter((p) => p.actual === null).map((p) => p.forecast ?? 0)

export default async function Forecasting() {
  const { src, ws, money } = await opsSource()
  const isDemo = src.kind === 'demo'
  let data: { dates: string[]; values: number[] } | null = null
  try {
    data = ws ? await getRevenueSeries(ws, 'week') : null
  } catch {
    data = null
  }
  if (!data || data.values.length < 8) {
    return (
      <>
        <PageHeader title="Forecasting" tagline="Weekly revenue forecast with honest, out-of-sample accuracy." />
        <EmptyState />
      </>
    )
  }

  const fc = forecast(data.values, data.dates, 'week', 8)
  // 60 weeks reproduces the published sample metrics; shorter uploads train on the first 60%.
  const minTrain = data.values.length >= 80 ? 60 : Math.max(8, Math.floor(data.values.length * 0.6))
  const wf1 = walkForwardBacktest(data.values, weeklyForecaster(data.dates), { minTrain, horizon: 1, step: 1 })
  const wf4 = walkForwardBacktest(data.values, weeklyForecaster(data.dates), { minTrain, horizon: 4, step: 4 })
  const measurable = wf1.origins >= 3
  const projectedTotal = fc.series.filter((p) => p.actual === null).reduce((s, p) => s + (p.forecast ?? 0), 0)

  const honest = measurable && wf1.metrics.r2 < 0.2

  return (
    <>
      <PageHeader title="Forecasting" tagline="Weekly revenue, model auto-selected by a leakage-free nested backtest." />

      {honest && (
        <aside className="mb-6 rounded-xl border border-warn/25 bg-warn/[0.06] px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="kicker text-warn">Honest accuracy</span>
            <span className="font-display text-sm font-semibold tabular-nums text-warn">
              R² {wf1.metrics.r2.toFixed(2)} · MAPE {wf1.metrics.mape.toFixed(0)}%
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-fg">
            On this {isDemo ? 'real, spiky series' : 'data'} the forecast <strong>barely beats a naive mean</strong>
            {` (R² ${wf1.metrics.r2.toFixed(2)} one-step, ${wf4.metrics.r2.toFixed(2)} at four weeks, measured out-of-sample over ${wf1.origins} walk-forward folds). `}
            {isDemo && <>This is far below the old README&apos;s &ldquo;0.90 R²&rdquo; claim, which was never reproduced on real data. </>}
            Plan against the shaded interval below — not the point estimate.
          </p>
        </aside>
      )}

      <KpiGrid>
        <Kpi label="Model" value={fc.model.split(' ')[0]} sub={fc.model} />
        <Kpi label="Projected (8 wk)" value={money(projectedTotal)} sub="point estimate" />
        <Kpi
          label="MAPE (1-step OOS)"
          value={measurable ? `${wf1.metrics.mape.toFixed(1)}%` : '—'}
          sub={measurable ? `${wf1.origins} walk-forward folds` : 'needs more weeks of history'}
        />
        <Kpi
          label="R² (1-step OOS)"
          value={measurable ? wf1.metrics.r2.toFixed(3) : '—'}
          sub={measurable && wf4.origins >= 3 ? `4-step R² ${wf4.metrics.r2.toFixed(3)}` : 'not enough folds to measure'}
        />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Weekly revenue — actual vs forecast (90% interval)</CardTitle>
          <Badge tone={isDemo ? 'neutral' : 'good'}>{isDemo ? 'SAMPLE DATA' : 'YOUR DATA'}</Badge>
        </CardHeader>
        <CardBody>
          <ForecastChart series={fc.series} />
        </CardBody>
      </Card>
    </>
  )
}
