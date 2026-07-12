/**
 * Shared chart palette — "the ledger". ECharts renders to canvas and can't read
 * CSS variables, so every chart imports these constants, keeping visualizations
 * on the same paper-and-ink system as the UI.
 */
export const CHART = {
  ink: '#1d1a14', // primary series / labels
  muted: '#6d675a', // axis labels, legends
  grid: '#e5e0d2', // split lines (hairline)
  axis: '#cfc8b5', // axis lines
  tooltipBg: '#faf8f2',
  tooltipBorder: '#d6cfbe',
} as const

/** Module accents (keys are historical registry ids; hues are the ledger palette). */
export const ACCENT = {
  cyan: '#0e5f57', // operations — petrol
  violet: '#653a5e', // market — aubergine
  lime: '#53641c', // product — moss
} as const

/** Translucent area fill for a given accent (line-chart bands). */
export const ACCENT_FILL = {
  cyan: 'rgba(14,95,87,0.10)',
  violet: 'rgba(101,58,94,0.10)',
  lime: 'rgba(83,100,28,0.10)',
} as const
