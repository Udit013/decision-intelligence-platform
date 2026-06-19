export function gbp(n: number): string {
  const a = Math.abs(Math.round(n))
  const s = a >= 1e6 ? `£${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `£${(a / 1e3).toFixed(1)}K` : `£${a}`
  return n < 0 ? `-${s}` : s
}

export function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n}%`
}
