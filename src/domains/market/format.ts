/** Formatters for the market domain's mixed units. Missing values render as "—". */
const NA = '—'
type N = number | null | undefined
const ok = (v: N): v is number => typeof v === 'number' && Number.isFinite(v)

export function usdFromBillions(b: N): string {
  if (!ok(b)) return NA
  if (b >= 1000) return `$${(b / 1000).toFixed(2)}T`
  return `$${Math.round(b).toLocaleString('en-US')}B`
}

export function usdFromMillions(m: N): string {
  if (!ok(m)) return NA
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`
  return `$${Math.round(m).toLocaleString('en-US')}M`
}

export function usdFromThousands(k: N): string {
  if (!ok(k)) return NA
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`
  return `$${Math.round(k).toLocaleString('en-US')}K`
}

/** Plain number (or "—"), with an optional suffix such as "%". */
export function num(v: N, suffix = ''): string {
  return ok(v) ? `${Math.round(v * 10) / 10}${suffix}` : NA
}
