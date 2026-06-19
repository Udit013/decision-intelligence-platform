'use client'

import { Chart } from '@/ui/charts/Chart'

/** Opportunity (x) vs Risk (y) scatter — the classic opportunity/risk matrix. */
export function MarketScatter({ points }: { points: { name: string; opportunity: number; risk: number; gdp: number }[] }) {
  return (
    <Chart
      height={380}
      option={{
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const d = (params as { data: [number, number, number, string] }).data
            return `${d[3]}<br/>Opportunity: ${d[0]}<br/>Risk: ${d[1]}`
          },
        },
        xAxis: { name: 'Opportunity →', type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#1a212c' } } },
        yAxis: { name: 'Risk →', type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#1a212c' } } },
        series: [
          {
            type: 'scatter',
            symbolSize: (d: number[]) => Math.max(6, Math.min(34, Math.sqrt(d[2]) / 3)),
            itemStyle: { color: '#8b5cf6', opacity: 0.6 },
            data: points.map((p) => [p.opportunity, p.risk, p.gdp, p.name]),
          },
        ],
      }}
    />
  )
}
