/**
 * Offline metrics on the REAL UCI Online Retail II data (no DB required).
 * Computes the honest numbers we put in the operations config comment block:
 * forecast accuracy (walk-forward), RFM segment mix, returns rate. Run:
 *   npx tsx --max-old-space-size=4096 scripts/operations-metrics.ts
 */
import { loadRetailRows, profile, printQuality, type RetailRow } from './lib/load-retail'
import { forecast } from '../src/core/forecast/index'
import { walkForwardBacktest, calibration, type Forecaster } from '../src/core/validation/index'
import { computeRfm } from '../src/core/segmentation/index'

function weekStart(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (x.getUTCDay() + 6) % 7 // Monday=0
  x.setUTCDate(x.getUTCDate() - day)
  return x.toISOString().slice(0, 10)
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

function series(rows: RetailRow[], keyFn: (d: Date) => string) {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.isCancellation || r.quantity <= 0 || r.price <= 0) continue
    map.set(keyFn(r.invoiceDate), (map.get(keyFn(r.invoiceDate)) ?? 0) + r.quantity * r.price)
  }
  const dates = [...map.keys()].sort()
  return { dates, values: dates.map((d) => Math.round(map.get(d)!)) }
}

console.log('Loading workbook (this takes ~20s)...')
const rows = loadRetailRows()
const q = profile(rows)
printQuality(q)

// ── Returns rate (real) ──
const grossSales = rows.filter((r) => !r.isCancellation && r.quantity > 0 && r.price > 0)
  .reduce((s, r) => s + r.quantity * r.price, 0)
const returnsValue = rows.filter((r) => r.isCancellation || r.quantity < 0)
  .reduce((s, r) => s + Math.abs(r.quantity) * r.price, 0)
console.log(`RETURNS: gross £${(grossSales / 1e6).toFixed(2)}M, returns £${(returnsValue / 1e6).toFixed(2)}M → ${((returnsValue / grossSales) * 100).toFixed(1)}% of gross\n`)

const coreForecaster = (grain: 'day' | 'week'): Forecaster => (train, h) => {
  const ds = Array.from({ length: train.length }, (_, i) => {
    const d = new Date('2009-12-01')
    d.setDate(d.getDate() + i * (grain === 'week' ? 7 : 1))
    return d.toISOString().slice(0, 10)
  })
  return forecast(train, ds, grain, h).series.filter((p) => p.actual === null).map((p) => p.forecast ?? 0)
}

// ── Weekly revenue forecast (business-relevant, more stable) ──
const wk = series(rows, weekStart)
console.log(`WEEKLY revenue series: ${wk.values.length} weeks (${wk.dates[0]} → ${wk.dates.at(-1)})`)
const wkF = forecast(wk.values, wk.dates, 'week', 8)
console.log(`  inline backtest (nested split): model=${wkF.model}  MAPE=${wkF.backtest?.mape}%  RMSE=${wkF.backtest?.rmse}`)
const wkWF1 = walkForwardBacktest(wk.values, coreForecaster('week'), { minTrain: 60, horizon: 1, step: 1 })
console.log(`  walk-forward (${wkWF1.origins} folds, h=1): MAPE=${wkWF1.metrics.mape.toFixed(1)}%  RMSE=${wkWF1.metrics.rmse.toFixed(0)}  R²=${wkWF1.metrics.r2.toFixed(3)}`)
const wkWF = walkForwardBacktest(wk.values, coreForecaster('week'), { minTrain: 60, horizon: 4, step: 4 })
console.log(`  walk-forward (${wkWF.origins} folds, h=4): MAPE=${wkWF.metrics.mape.toFixed(1)}%  RMSE=${wkWF.metrics.rmse.toFixed(0)}  R²=${wkWF.metrics.r2.toFixed(3)}`)

// ── Daily revenue forecast (noisier, weekday seasonality m=7) ──
const dy = series(rows, dayKey)
console.log(`\nDAILY revenue series: ${dy.values.length} days`)
const dyF = forecast(dy.values, dy.dates, 'day', 14)
console.log(`  inline backtest (nested split): model=${dyF.model}  MAPE=${dyF.backtest?.mape}%  RMSE=${dyF.backtest?.rmse}`)
const dyWF = walkForwardBacktest(dy.values, coreForecaster('day'), { minTrain: 365, horizon: 7, step: 14 })
console.log(`  walk-forward (${dyWF.origins} folds, h=7): MAPE=${dyWF.metrics.mape.toFixed(1)}%  RMSE=${dyWF.metrics.rmse.toFixed(0)}  R²=${dyWF.metrics.r2.toFixed(3)}`)

// ── RFM on real customers ──
const byCustomer = new Map<string, { last: number; freq: Set<string>; monetary: number }>()
let maxDate = -Infinity
for (const r of rows) if (r.invoiceDate.getTime() > maxDate) maxDate = r.invoiceDate.getTime()
for (const r of rows) {
  if (!r.customerId || r.isCancellation || r.quantity <= 0 || r.price <= 0) continue
  let c = byCustomer.get(r.customerId)
  if (!c) byCustomer.set(r.customerId, (c = { last: 0, freq: new Set(), monetary: 0 }))
  c.last = Math.max(c.last, r.invoiceDate.getTime())
  c.freq.add(r.invoice)
  c.monetary += r.quantity * r.price
}
const rfmInput = [...byCustomer.values()].map((c) => ({
  recency: Math.round((maxDate - c.last) / 86400000),
  frequency: c.freq.size,
  monetary: c.monetary,
}))
const rfm = computeRfm(rfmInput, 5)
const segCounts = new Map<string, number>()
for (const c of rfm) segCounts.set(c.segment, (segCounts.get(c.segment) ?? 0) + 1)
console.log(`\nRFM: ${rfm.length.toLocaleString()} customers`)
for (const [seg, n] of [...segCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${seg.padEnd(18)} ${n.toString().padStart(5)}  (${((n / rfm.length) * 100).toFixed(1)}%)`)
}

// ── Calibration sanity on a trivial real-data proxy ──
// (Full recommendation calibration needs realized outcomes over time; shown in-app later.)
const cal = calibration(rfm.map((c) => ({ confidence: c.r / 5, correct: c.recency < 90 })))
console.log(`\nCALIBRATION proxy (R-score vs active<90d): ECE=${cal.ece.toFixed(3)} Brier=${cal.brier.toFixed(3)}`)
console.log('\nDone.')
