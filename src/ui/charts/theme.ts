/**
 * Shared chart palette. ECharts renders to canvas and can't read CSS variables,
 * so every chart imports these constants, keeping visualizations on the same
 * system as the UI.
 */
export const CHART = {
  ink: '#1d1f21', // primary series / labels
  muted: '#6e7178', // axis labels, legends
  grid: '#e9e8e2', // split lines (hairline)
  axis: '#d6d5cd', // axis lines
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e1da',
} as const

/** Module accents (keys are historical registry ids). */
export const ACCENT = {
  cyan: '#22635f', // operations — pine
  violet: '#55498f', // market — iris
  lime: '#55693c', // product — moss
} as const

/** Translucent area fill for a given accent (line-chart bands). */
export const ACCENT_FILL = {
  cyan: 'rgba(34,99,95,0.08)',
  violet: 'rgba(85,73,143,0.08)',
  lime: 'rgba(85,105,60,0.08)',
} as const
