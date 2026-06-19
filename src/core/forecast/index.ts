/**
 * Time-series forecasting — pure TypeScript, no Python required.
 *
 * Promoted to /core from retail's `lib/intelligence/forecast.ts` — it was the only
 * forecasting capability across the three repos, and it already did the right
 * thing: build candidate models (Holt-Winters / linear trend / drift), then SELECT
 * the model by a real holdout backtest rather than in-sample fit.
 *
 * Generalized here: decoupled from the retail data layer (own Grain + date
 * stepping), depends only on core/stats. Any domain can forecast any numeric
 * series. Honest accuracy comes from the `backtest` field (out-of-sample), not the
 * in-sample `metrics`.
 */
import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns'
import { mean, std, linearRegression, zForConfidence, clamp } from '@/core/stats'

export type Grain = 'day' | 'week' | 'month'

export interface ForecastPoint {
  date: string
  actual: number | null
  forecast: number | null
  lower: number | null
  upper: number | null
}

export interface ForecastResult {
  model: string
  seasonality: number
  trendPerStep: number
  confidence: number
  /** IN-SAMPLE fit quality (optimistic — do not report as accuracy). */
  metrics: { mape: number; rmse: number; r2: number }
  /** OUT-OF-SAMPLE holdout accuracy (the honest number), null if series too short. */
  backtest: { mape: number; rmse: number; periods: number } | null
  series: ForecastPoint[]
}

const SEASON_BY_GRAIN: Record<Grain, number> = { day: 7, week: 52, month: 12 }

function nextDate(last: string, grain: Grain, step: number): string {
  const d = parseISO(last)
  const out = grain === 'day' ? addDays(d, step) : grain === 'week' ? addWeeks(d, step) : addMonths(d, step)
  return format(out, 'yyyy-MM-dd')
}

function rmse(actual: number[], pred: number[]): number {
  const n = Math.min(actual.length, pred.length)
  if (!n) return 0
  let s = 0
  for (let i = 0; i < n; i++) s += (actual[i] - pred[i]) ** 2
  return Math.sqrt(s / n)
}

function mape(actual: number[], pred: number[]): number {
  const pairs = actual.map((a, i) => [a, pred[i]] as const).filter(([a]) => a !== 0)
  if (!pairs.length) return 0
  return mean(pairs.map(([a, p]) => Math.abs((a - p) / a))) * 100
}

function r2(actual: number[], pred: number[]): number {
  const m = mean(actual)
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < actual.length; i++) {
    ssRes += (actual[i] - pred[i]) ** 2
    ssTot += (actual[i] - m) ** 2
  }
  return ssTot === 0 ? 0 : clamp(1 - ssRes / ssTot, -1, 1)
}

interface HW {
  fitted: number[]
  level: number
  trend: number
  season: number[]
  m: number
}

function holtWinters(y: number[], m: number, alpha: number, beta: number, gamma: number): HW {
  const season = new Array(m).fill(0)
  const firstSeasonMean = mean(y.slice(0, m))
  for (let i = 0; i < m; i++) season[i] = y[i] - firstSeasonMean
  let level = firstSeasonMean
  let trend = (mean(y.slice(m, 2 * m)) - firstSeasonMean) / m
  if (!isFinite(trend)) trend = 0

  const fitted: number[] = []
  for (let t = 0; t < y.length; t++) {
    const s = season[t % m]
    fitted.push(level + trend + s)
    const prevLevel = level
    level = alpha * (y[t] - s) + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    season[t % m] = gamma * (y[t] - level) + (1 - gamma) * s
  }
  return { fitted, level, trend, season, m }
}

interface Candidate {
  model: string
  seasonality: number
  trendPerStep: number
  fitted: number[]
  project: (h: number) => number
}

/** Build every applicable model for a series (used for both fitting and backtest). */
function buildCandidates(vals: number[], m: number): Candidate[] {
  const k = vals.length
  const out: Candidate[] = []

  // Holt-Winters (seasonal) — needs >= 2 full seasons + 1.
  if (k >= 2 * m + 1) {
    let best = { a: 0.3, b: 0.05, g: 0.2 }
    let bestErr = Infinity
    for (const a of [0.1, 0.3, 0.5, 0.8]) {
      for (const b of [0.01, 0.05, 0.2]) {
        for (const g of [0.05, 0.2, 0.5]) {
          const err = rmse(vals.slice(1), holtWinters(vals, m, a, b, g).fitted.slice(1))
          if (err < bestErr) {
            bestErr = err
            best = { a, b, g }
          }
        }
      }
    }
    const hw = holtWinters(vals, m, best.a, best.b, best.g)
    out.push({
      model: 'Holt-Winters (seasonal)',
      seasonality: m,
      trendPerStep: hw.trend,
      fitted: hw.fitted,
      project: (h) => hw.level + h * hw.trend + hw.season[(k + h - 1) % m],
    })
  }

  // Linear trend (OLS on index).
  if (k >= 4) {
    const fit = linearRegression(vals)
    out.push({
      model: 'Linear trend',
      seasonality: 0,
      trendPerStep: fit.slope,
      fitted: vals.map((_, i) => fit.predict(i)),
      project: (h) => fit.predict(k - 1 + h),
    })
  }

  // Drift / random-walk-with-drift — always available.
  {
    const last = vals[k - 1] ?? 0
    const drift = k >= 2 ? (vals[k - 1] - vals[0]) / (k - 1) : 0
    out.push({
      model: 'Drift',
      seasonality: 0,
      trendPerStep: drift,
      fitted: vals.map((_, i) => (i === 0 ? vals[0] : vals[i - 1] + drift)),
      project: (h) => last + h * drift,
    })
  }

  return out
}

/** Holdout size for an inner validation split of a series of length `len`. */
function innerHoldout(len: number): number {
  return Math.min(Math.max(2, Math.floor(len * 0.2)), Math.max(0, len - 4))
}

/**
 * Choose the best model TYPE for `vals` WITHOUT looking at any data outside `vals`.
 *
 * Uses a nested (inner) holdout: select the model type by its out-of-sample error
 * on an inner validation slice of `vals`, never on the caller's reported holdout.
 * Grid search + fitting happen inside `buildCandidates(innerTrain)`, so smoothing
 * params and the OLS fit see only the inner training points. Falls back to best
 * in-sample fit only when `vals` is too short for an inner split (still never
 * touching any outer holdout).
 */
function selectModelType(vals: number[], m: number): string {
  const nt = vals.length
  const vInner = innerHoldout(nt)
  if (vInner >= 2 && nt - vInner >= 4) {
    const innerTrain = vals.slice(0, nt - vInner)
    const innerVal = vals.slice(nt - vInner)
    const cands = buildCandidates(innerTrain, m)
    let bestName = ''
    let bestErr = Infinity
    for (const c of cands) {
      const err = rmse(innerVal, innerVal.map((_, i) => c.project(i + 1)))
      if (err < bestErr) {
        bestErr = err
        bestName = c.model
      }
    }
    if (bestName) return bestName
  }
  // Fallback (short series): best in-sample fit on `vals` — still no outside data.
  const cands = buildCandidates(vals, m)
  return cands.reduce((best, c) =>
    rmse(vals.slice(1), c.fitted.slice(1)) < rmse(vals.slice(1), best.fitted.slice(1)) ? c : best,
  ).model
}

/** Refit a named model type on `vals` and return its candidate (grid search re-run on `vals`). */
function fitSelected(vals: number[], m: number, name: string): Candidate {
  const cands = buildCandidates(vals, m)
  return cands.find((c) => c.model === name) ?? cands[cands.length - 1]
}

/**
 * Forecast a numeric series `horizon` steps ahead.
 * @param values  historical values aligned to `dates`
 * @param dates   ISO date strings (period starts)
 * @param grain   day | week | month — controls seasonality & future date stepping
 * @param horizon number of future periods to predict
 * @param confidence two-sided CI level (default 0.9)
 */
export function forecast(
  values: number[],
  dates: string[],
  grain: Grain,
  horizon: number,
  confidence = 0.9,
): ForecastResult {
  const n = values.length
  const z = zForConfidence(confidence)
  const m = SEASON_BY_GRAIN[grain]
  const history: ForecastPoint[] = []
  const future: ForecastPoint[] = []

  const vK = Math.min(horizon, Math.max(2, Math.floor(n * 0.2)))

  // ── Honest backtest via NESTED split ──────────────────────────────────────────
  // Outer holdout = values[n−vK:] is used ONLY to report error. The model TYPE is
  // selected by `selectModelType(train)`, which runs its own inner holdout entirely
  // within `train` — so the reported holdout never influences model selection or
  // parameter tuning. No selection-on-test optimism; defensible without a footnote.
  let backtest: ForecastResult['backtest'] = null
  if (n - vK >= 4) {
    const train = values.slice(0, n - vK)
    const holdout = values.slice(n - vK)
    const name = selectModelType(train, m) // inner split inside train only
    const fittedModel = fitSelected(train, m, name) // refit selected type on full train
    const preds = holdout.map((_, i) => fittedModel.project(i + 1))
    backtest = {
      mape: Math.round(mape(holdout, preds) * 10) / 10,
      rmse: Math.round(rmse(holdout, preds) * 100) / 100,
      periods: vK,
    }
  }

  // ── Final forward model ───────────────────────────────────────────────────────
  // Select the type on an inner validation split of the full series (never peeking
  // at the future, which doesn't exist), then refit it on all of `values`.
  const chosen = fitSelected(values, m, selectModelType(values, m))
  const { model, seasonality, trendPerStep, fitted, project } = chosen

  const residuals = values.map((v, i) => v - (fitted[i] ?? v)).slice(1)
  const resStd = std(residuals) || std(values) * 0.1 || 1

  for (let i = 0; i < n; i++) {
    history.push({
      date: dates[i],
      actual: values[i],
      forecast: Math.max(0, Math.round(fitted[i] ?? values[i])),
      lower: null,
      upper: null,
    })
  }

  const lastDate = dates[n - 1]
  for (let h = 1; h <= horizon; h++) {
    const yhat = Math.max(0, project(h))
    const band = z * resStd * Math.sqrt(h)
    future.push({
      date: nextDate(lastDate, grain, h),
      actual: null,
      forecast: Math.round(yhat),
      lower: Math.max(0, Math.round(yhat - band)),
      upper: Math.round(yhat + band),
    })
  }

  const fittedM = fitted.slice(1)
  const actualM = values.slice(1)

  return {
    model,
    seasonality,
    trendPerStep: Math.round(trendPerStep * 100) / 100,
    confidence,
    metrics: {
      mape: Math.round(mape(actualM, fittedM) * 10) / 10,
      rmse: Math.round(rmse(actualM, fittedM) * 100) / 100,
      r2: Math.round(r2(actualM, fittedM) * 1000) / 1000,
    },
    backtest,
    series: [...history, ...future],
  }
}
