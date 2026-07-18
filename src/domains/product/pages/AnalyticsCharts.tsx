'use client'

import { Chart } from '@/ui/charts/Chart'
import { CHART, ACCENT, ACCENT_FILL } from '@/ui/charts/theme'
import type { CohortRow } from '@/core/cohort'

export function FunnelChart({ steps }: { steps: { step: string; users: number }[] }) {
  return (
    <Chart
      height={260}
      option={{
        grid: { left: 120 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: CHART.grid } } },
        yAxis: { type: 'category', data: [...steps].reverse().map((s) => s.step), axisLine: { lineStyle: { color: CHART.axis } } },
        series: [{ type: 'bar', data: [...steps].reverse().map((s) => s.users), itemStyle: { color: ACCENT.lime, borderRadius: [0, 4, 4, 0] } }],
      }}
    />
  )
}

export function RetentionCurve({ pooled }: { pooled: { offset: number; ratePct: number }[] }) {
  return (
    <Chart
      height={260}
      option={{
        tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v}%` },
        xAxis: { type: 'category', data: pooled.map((p) => `D${p.offset}`) },
        yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: CHART.grid } } },
        series: [{ type: 'line', data: pooled.map((p) => p.ratePct), smooth: true, areaStyle: { color: ACCENT_FILL.lime }, itemStyle: { color: ACCENT.lime }, lineStyle: { color: ACCENT.lime, width: 2 }, symbolSize: 6 }],
      }}
    />
  )
}

export function CohortHeatmap({ matrix, offsets }: { matrix: CohortRow[]; offsets: number[] }) {
  const rows = matrix.filter((r) => r.size >= 5) // hide tiny cohorts (noisy)
  const data: [number, number, number][] = []
  rows.forEach((row, y) => {
    offsets.forEach((off, x) => {
      const rate = row.cells.find((c) => c.offset === off)?.rate ?? 0
      data.push([x, y, Math.round(rate * 100)])
    })
  })
  return (
    <Chart
      height={Math.max(220, rows.length * 28 + 80)}
      option={{
        grid: { left: 70, top: 30, right: 20, bottom: 40 },
        tooltip: { position: 'top', formatter: (p: unknown) => { const d = (p as { value: [number, number, number] }).value; return `${rows[d[1]].cohortKey} · D${offsets[d[0]]}: ${d[2]}%` } },
        xAxis: { type: 'category', data: offsets.map((o) => `D${o}`), splitArea: { show: true } },
        yAxis: { type: 'category', data: rows.map((r) => r.cohortKey), splitArea: { show: true } },
        visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#edede9', '#a9bb8a', '#55693c'] }, textStyle: { color: CHART.muted } },
        series: [{ type: 'heatmap', data, label: { show: true, formatter: (p: unknown) => `${(p as { value: [number, number, number] }).value[2]}`, color: CHART.ink, fontSize: 10 } }],
      }}
    />
  )
}
