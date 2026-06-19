'use client'

import { Chart } from '@/ui/charts/Chart'
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
        legend: { data: ['Actual', 'Forecast'], textStyle: { color: '#8a94a6' }, top: 0 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#232a36' } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a212c' } } },
        series: [
          { name: 'lower', type: 'line', data: lower, lineStyle: { opacity: 0 }, stack: 'band', symbol: 'none', silent: true },
          { name: 'band', type: 'line', data: range, lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(34,211,238,0.12)' }, stack: 'band', symbol: 'none', silent: true },
          { name: 'Actual', type: 'line', data: actual, showSymbol: false, lineStyle: { width: 2, color: '#e7ecf3' }, connectNulls: false },
          { name: 'Forecast', type: 'line', data: fcast, showSymbol: false, lineStyle: { width: 2, color: '#22d3ee', type: 'dashed' } },
        ],
      }}
    />
  )
}
