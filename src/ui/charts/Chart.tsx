'use client'

/**
 * The single charting primitive for the whole platform (Apache ECharts).
 * Recharts and Chart.js are intentionally NOT dependencies — every visualization
 * in every domain goes through this wrapper so theming stays consistent.
 *
 * Only the modules we use are registered, keeping the client bundle small.
 */
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, ScatterChart, HeatmapChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  VisualMapComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { CHART } from './theme'

echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
])

/** Shared dark theme baseline merged into every chart's option. */
function withTheme(option: EChartsOption): EChartsOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'Hanken Grotesk', ui-sans-serif, sans-serif", fontSize: 11, color: CHART.muted },
    grid: { left: 48, right: 24, top: 32, bottom: 40, containLabel: true, ...(option.grid as object) },
    tooltip: {
      backgroundColor: CHART.tooltipBg,
      borderColor: CHART.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: CHART.ink },
      extraCssText: 'box-shadow: 0 8px 16px rgba(19,23,34,0.08), 0 20px 40px rgba(19,23,34,0.10); border-radius: 10px; padding: 10px 12px;',
      ...(option.tooltip as object),
    },
    ...option,
  }
}

export function Chart({
  option,
  height = 320,
  className,
}: {
  option: EChartsOption
  height?: number | string
  className?: string
}) {
  const themed = useMemo(() => withTheme(option), [option])
  return (
    <ReactECharts
      echarts={echarts}
      option={themed}
      style={{ height, width: '100%' }}
      className={className}
      notMerge
      lazyUpdate
    />
  )
}
