import { describe, it, expect } from 'vitest'
import { forecast } from './index'

function dailyDates(n: number, start = '2023-01-01'): string[] {
  const out: string[] = []
  const d = new Date(start)
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

describe('forecast', () => {
  it('extrapolates a clean linear trend upward', () => {
    const n = 60
    const values = Array.from({ length: n }, (_, i) => 100 + 5 * i)
    const dates = dailyDates(n)
    const res = forecast(values, dates, 'day', 10)

    const future = res.series.filter((p) => p.actual === null)
    expect(future).toHaveLength(10)
    // Next point should continue the +5/step trend (allow model slack).
    expect(future[0].forecast!).toBeGreaterThan(values[n - 1])
    expect(res.trendPerStep).toBeGreaterThan(0)
    // CI bands present and ordered.
    expect(future[0].lower!).toBeLessThanOrEqual(future[0].forecast!)
    expect(future[0].upper!).toBeGreaterThanOrEqual(future[0].forecast!)
  })

  it('produces an out-of-sample backtest for long series', () => {
    const n = 90
    const values = Array.from({ length: n }, (_, i) => 200 + 2 * i + 10 * Math.sin((i / 7) * 2 * Math.PI))
    const res = forecast(values, dailyDates(n), 'day', 14)
    expect(res.backtest).not.toBeNull()
    expect(res.backtest!.periods).toBeGreaterThan(0)
    expect(res.backtest!.mape).toBeGreaterThanOrEqual(0)
  })

  it('CI widens with horizon', () => {
    const n = 50
    const values = Array.from({ length: n }, (_, i) => 100 + i + (i % 5))
    const res = forecast(values, dailyDates(n), 'day', 10)
    const future = res.series.filter((p) => p.actual === null)
    const band1 = future[0].upper! - future[0].lower!
    const bandLast = future[future.length - 1].upper! - future[future.length - 1].lower!
    expect(bandLast).toBeGreaterThanOrEqual(band1)
  })

  it('never emits negative forecasts', () => {
    const values = [5, 4, 3, 2, 1, 0, 1, 0, 2, 1]
    const res = forecast(values, dailyDates(values.length), 'day', 8)
    for (const p of res.series) {
      if (p.forecast !== null) expect(p.forecast).toBeGreaterThanOrEqual(0)
      if (p.lower !== null) expect(p.lower).toBeGreaterThanOrEqual(0)
    }
  })

  it('backtest is unbiased: a regime shift in the holdout is NOT fitted away', () => {
    // Train is cleanly linear (selection will favor a trend model); the holdout
    // drops to a flat low level. An unbiased backtest cannot have "cheated" by
    // picking the model that happens to fit the holdout, so the error must be large.
    const train = Array.from({ length: 50 }, (_, i) => 100 + 5 * i) // 100..345
    const holdout = Array.from({ length: 10 }, () => 40) // sudden crash
    const values = [...train, ...holdout]
    const res = forecast(values, dailyDates(values.length), 'day', 10)
    expect(res.backtest).not.toBeNull()
    // Trend extrapolation vs a flat 40 ⇒ massive out-of-sample miss.
    expect(res.backtest!.mape).toBeGreaterThan(50)
  })

  it('backtest reports ~0 error when the future genuinely matches the trend', () => {
    const values = Array.from({ length: 60 }, (_, i) => 20 + 3 * i)
    const res = forecast(values, dailyDates(60), 'day', 10)
    expect(res.backtest).not.toBeNull()
    expect(res.backtest!.mape).toBeLessThan(5)
  })

  it('handles short series gracefully (no backtest)', () => {
    const values = [10, 12, 11]
    const res = forecast(values, dailyDates(3), 'day', 3)
    expect(res.series.filter((p) => p.actual === null)).toHaveLength(3)
    expect(res.backtest).toBeNull()
  })
})
