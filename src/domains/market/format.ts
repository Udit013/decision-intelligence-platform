/** USD formatters for the market domain's mixed units (ported from geostrategy). */

export function usdFromBillions(b: number): string {
  if (b >= 1000) return `$${(b / 1000).toFixed(2)}T`
  return `$${Math.round(b).toLocaleString()}B`
}

export function usdFromMillions(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`
  return `$${Math.round(m).toLocaleString()}M`
}

export function usdFromThousands(k: number): string {
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`
  return `$${Math.round(k).toLocaleString()}K`
}
