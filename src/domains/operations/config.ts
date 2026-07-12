/**
 * ════════════════════════════════════════════════════════════════════════════
 *  OPERATIONS — HONEST METRICS (measured on REAL data, not carried over)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Dataset: UCI "Online Retail II" — a real UK online gift/homeware retailer,
 *  2009-12-01 → 2011-12-09. 1,067,371 raw rows → 1,041,670 clean sale lines
 *  (97.6% kept). 5,942 customers, 5,304 products, 43 countries (UK 91.9%).
 *  Data-quality flags found pre-seed: 22.8% rows missing Customer ID, 1.8%
 *  cancellations, 2.2% non-positive quantity, 3.2% exact duplicate rows.
 *  (Reproduce: `npx tsx --max-old-space-size=4096 scripts/operations-metrics.ts`)
 *
 *  REVENUE FORECAST ACCURACY — measured by the validation harness
 *  (walk-forward, leakage-free; see src/core/validation):
 *    • Weekly revenue, 1-step ahead (44 folds):  MAPE 30.3%  R²  0.072
 *    • Weekly revenue, 4-step ahead (11 folds):  MAPE 31.2%  R² -0.026
 *    • Daily  revenue, 7-step ahead (18 folds):  MAPE 61.3%  R² -0.088
 *
 *  ⚠️ HONEST READING: on this spiky real series (huge Nov/Dec peaks, lumpy
 *  wholesale orders) the forecast barely beats a naive mean — R² is ~0 and goes
 *  NEGATIVE at multi-step horizons. This is FAR worse than the old retail repo's
 *  README, which advertised Holt-Winters "0.90 R² / 86% accuracy". Those numbers
 *  were never reproduced on real data and are NOT carried over. We report the
 *  true numbers in-UI, including R² ≤ 0, and surface the prediction interval so
 *  the uncertainty is visible rather than hidden.
 *
 *  RETURNS: £1.53M returned of £20.97M gross = 7.3% (real, from credit notes).
 *
 *  CUSTOMER RFM (real, 5,878 customers with IDs): Champions 22.9%, Loyal 21.0%,
 *  Monitor 19.9%, Hibernating 14.7%, Needs Attention 7.2%, New 5.5%,
 *  Promising 4.9%, At Risk 3.9%.
 *
 *  ESTIMATED-COST CAVEAT: inventory & pricing margin/profit are ESTIMATES — the
 *  dataset has no cost or stock. Cost is assumed at a category-level ratio of
 *  price (see ./assumptions.ts) and every such figure is labeled "estimated"
 *  in the UI and PDF. Revenue/orders/customers/forecasts use real columns only.
 * ════════════════════════════════════════════════════════════════════════════
 */
import type { Bucket } from '@/core/scoring'
import { COST_ASSUMPTION_NOTE } from './assumptions'

/** Accent + provenance shown by the shell (mirrors the registry). */
export const OPERATIONS_META = {
  brand: 'CoreSight IQ',
  reportTitle: 'Operations — Executive Report',
  accentRgb: [14, 95, 87] as [number, number, number],
  dataNote: 'Real data: UCI Online Retail II (2009–2011). ' + COST_ASSUMPTION_NOTE,
}

/** Decision Center bucket tiers for ranked operations decisions (0–100 composite). */
export const DECISION_BUCKETS: Bucket[] = [
  { label: 'Act now', min: 66 },
  { label: 'Plan', min: 33 },
  { label: 'Monitor', min: 0 },
]

/** AI advisor persona for the operations domain. */
export const ADVISOR_PERSONA =
  'You are the Operations analyst for a retail business. You are precise about what is measured vs estimated.'

/** Measured forecast accuracy, surfaced in-UI so the honest numbers are visible. */
export const MEASURED_FORECAST_ACCURACY = {
  weekly1Step: { mape: 30.3, r2: 0.072, folds: 44 },
  weekly4Step: { mape: 31.2, r2: -0.026, folds: 11 },
  daily7Step: { mape: 61.3, r2: -0.088, folds: 18 },
  note: 'Walk-forward (out-of-sample). On this spiky real series the model barely beats a naive mean; multi-step R² is ≤ 0. Old README "0.90 R²" was not reproduced and is not used.',
}
