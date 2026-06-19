'use client'

import { Chart } from '@/ui/charts/Chart'
import { CHART, ACCENT, ACCENT_FILL } from '@/ui/charts/theme'
import type { ForecastPoint } from '@/core/forecast'

/** Actuals + forecast line with a shaded confidence band. */
export function ForecastChart({ series }: { series: ForecastPoint[] }) {
  const dates = series.map((p) => p.date)
  const actual = series.map((p) => p.actual)
  const fcast = series.map((p) => p.forecast)
  // Band rendered as lower line + stacked (upper-lower) area, only on future points.
  const lower = series.map((p) => p.lower)
  const range = series.map((p) => (p.upper != null && p.lower != null ? p.upper - p.lower : null))

  return (
    <Chart
      height={360}
      option={{
        legend: { data: ['Actual', 'Forecast'], textStyle: { color: CHART.muted }, top: 0 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: CHART.axis } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: CHART.grid } } },
        series: [
          { name: 'lower', type: 'line', data: lower, lineStyle: { opacity: 0 }, stack: 'band', symbol: 'none', silent: true },
          { name: 'band', type: 'line', data: range, lineStyle: { opacity: 0 }, areaStyle: { color: ACCENT_FILL.cyan }, stack: 'band', symbol: 'none', silent: true },
          { name: 'Actual', type: 'line', data: actual, showSymbol: false, lineStyle: { width: 2, color: CHART.ink }, connectNulls: false },
          { name: 'Forecast', type: 'line', data: fcast, showSymbol: false, lineStyle: { width: 2, color: ACCENT.cyan, type: 'dashed' } },
        ],
      }}
    />
  )
}
