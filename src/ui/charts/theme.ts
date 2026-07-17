/**
 * Shared chart palette. ECharts renders to canvas and can't read CSS variables,
 * so every chart imports these constants, keeping visualizations on the same
 * system as the UI.
 */
export const CHART = {
  ink: '#131722', // primary series / labels
  muted: '#647082', // axis labels, legends
  grid: '#eceef2', // split lines (hairline)
  axis: '#d8dce4', // axis lines
  tooltipBg: '#ffffff',
  tooltipBorder: '#e5e8ee',
} as const

/** Module accents (keys are historical registry ids). */
export const ACCENT = {
  cyan: '#0d7570', // operations — deep teal
  violet: '#6641c8', // market — refined violet
  lime: '#1d7a4c', // product — emerald
} as const

/** Translucent area fill for a given accent (line-chart bands). */
export const ACCENT_FILL = {
  cyan: 'rgba(13,117,112,0.09)',
  violet: 'rgba(102,65,200,0.09)',
  lime: 'rgba(29,122,76,0.09)',
} as const
