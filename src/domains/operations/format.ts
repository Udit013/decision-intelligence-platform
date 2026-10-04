/** Compact money: £1.23M / 45.6K. Visitor data carries no currency, so it gets no symbol. */
export function money(n: number, symbol = ''): string {
  const a = Math.abs(n)
  const s =
    a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a >= 100 ? `${Math.round(a)}` : a.toFixed(2)
  return `${n < 0 ? '-' : ''}${symbol}${s}`
}

/** The UCI sample is in pounds sterling; uploaded files keep their own (unstated) currency. */
export function currencySymbol(kind: 'workspace' | 'demo' | 'empty'): string {
  return kind === 'demo' ? '£' : ''
}

export function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n}%`
}
