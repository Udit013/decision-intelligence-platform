import { forecast } from '@/core/forecast'
import { walkForwardBacktest, type Forecaster } from '@/core/validation'
import { getRevenueSeries } from '../data'
import { gbp } from '../format'
import { ForecastChart } from './ForecastChart'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { Kpi, KpiGrid, PageHeader, EmptyState } from '@/ui/components/Kpi'

const weeklyForecaster: Forecaster = (train, h) => {
  const ds = Array.from({ length: train.length }, (_, i) => {
    const d = new Date('2009-12-01')
    d.setDate(d.getDate() + i * 7)
    return d.toISOString().slice(0, 10)
  })
  return forecast(train, ds, 'week', h).series.filter((p) => p.actual === null).map((p) => p.forecast ?? 0)
}

export default async function Forecasting() {
  let data: { dates: string[]; values: number[] } | null = null
  try {
    data = await getRevenueSeries('week')
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
  const wf1 = walkForwardBacktest(data.values, weeklyForecaster, { minTrain: 60, horizon: 1, step: 1 })
  const wf4 = walkForwardBacktest(data.values, weeklyForecaster, { minTrain: 60, horizon: 4, step: 4 })
  const projectedTotal = fc.series.filter((p) => p.actual === null).reduce((s, p) => s + (p.forecast ?? 0), 0)

  const honest = wf1.metrics.r2 < 0.2

  return (
    <>
      <PageHeader title="Forecasting" tagline="Weekly revenue, model auto-selected by a leakage-free nested backtest." />

      {honest && (
        <div className="mb-6 rounded-lg border-2 border-warn/60 bg-warn/15 p-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-warn">⚠ Honest accuracy</span>
            <span className="rounded-full bg-warn/20 px-2 py-0.5 font-mono text-xs font-bold text-warn">
              R² {wf1.metrics.r2.toFixed(2)} · MAPE {wf1.metrics.mape.toFixed(0)}%
            </span>
          </div>
          <p className="mt-2 text-sm text-fg">
            On this real, spiky series the forecast <strong>barely beats a naive mean</strong> (R²{' '}
            {wf1.metrics.r2.toFixed(2)} one-step, {wf4.metrics.r2.toFixed(2)} at four weeks, measured out-of-sample over{' '}
            {wf1.origins} walk-forward folds). This is far below the old README&apos;s &ldquo;0.90 R²&rdquo; claim, which was
            never reproduced on real data. Plan against the shaded interval below — not the point estimate.
          </p>
        </div>
      )}

      <KpiGrid>
        <Kpi label="Model" value={fc.model.split(' ')[0]} sub={fc.model} />
        <Kpi label="Projected (8 wk)" value={gbp(projectedTotal)} sub="point estimate" />
        <Kpi label="MAPE (1-step OOS)" value={`${wf1.metrics.mape.toFixed(1)}%`} sub={`${wf1.origins} walk-forward folds`} />
        <Kpi label="R² (1-step OOS)" value={wf1.metrics.r2.toFixed(3)} sub={`4-step R² ${wf4.metrics.r2.toFixed(3)}`} />
      </KpiGrid>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Weekly revenue — actual vs forecast (90% interval)</CardTitle>
          <Badge tone="good">REAL DATA</Badge>
        </CardHeader>
        <CardBody>
          <ForecastChart series={fc.series} />
        </CardBody>
      </Card>
    </>
  )
}
