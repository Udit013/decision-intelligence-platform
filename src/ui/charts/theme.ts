/**
 * Shared chart palette (light theme). ECharts renders to canvas and can't read CSS
 * variables, so every chart imports these constants — keeping all visualizations
 * consistent with the CoreSight IQ light design system.
 */
export const CHART = {
  ink: '#0f172a', // primary text / dark series line
  muted: '#64748b', // axis labels, legends
  grid: '#eef2f7', // split lines
  axis: '#dbe1ea', // axis lines
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e6ed',
} as const

/** Domain accents, tuned for contrast on a white background. */
export const ACCENT = {
  cyan: '#0891b2', // operations
  violet: '#7c3aed', // market
  lime: '#4d7c0f', // product
} as const

/** Translucent area fill for a given accent (line-chart bands). */
export const ACCENT_FILL = {
  cyan: 'rgba(8,145,178,0.10)',
  violet: 'rgba(124,58,237,0.10)',
  lime: 'rgba(77,124,15,0.10)',
} as const
