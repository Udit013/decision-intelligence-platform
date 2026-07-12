/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MARKET — provenance & honest notes
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ DEMO DATA. Every market figure is SYNTHETIC and every score is MODELED.
 *  Unlike Operations (real UCI data), this domain has no ground truth — the UI
 *  labels it "DEMO DATA / MODELED" at the top level, and all weights/formulas are
 *  flagged as estimates, not measurements.
 *
 *  MARKET COUNT — the old geostrategy README claimed "121 markets". That count
 *  included a DUPLICATE Pakistan row (codes PK and PK2) that survived because the
 *  generator deduped only by code. The duplicate is removed and the real distinct
 *  count is MARKET_COUNT (= 120), reported in-UI. We do not carry over "121".
 *
 *  MODELED SCORING — opportunity/risk/ease and the Expand/Investigate/Monitor/
 *  Avoid classifier are computed from editorial weights (see scoring.ts:
 *  MARKET_DECISION_WEIGHTS, MARKET_BUCKETS). The classifier itself is the shared
 *  core/scoreAndClassify primitive — not a market-specific reimplementation.
 *  ROI multiples, entry-strategy costs, and the 24-month scenario projections are
 *  illustrative models, not forecasts; they carry no validated accuracy.
 * ════════════════════════════════════════════════════════════════════════════
 */
import { MARKET_COUNT } from './generator'

export const MARKET_META = {
  brand: 'CoreSight IQ',
  reportTitle: 'Market — Expansion Boardroom Report',
  accentRgb: [101, 58, 94] as [number, number, number],
  marketCount: MARKET_COUNT,
  demoNote: `Demo data: ${MARKET_COUNT} synthetic markets. All scores are modeled from editorial weights — no validated accuracy. (Old README claimed 121; that included a duplicate Pakistan, now removed.)`,
}

export const ADVISOR_PERSONA =
  'You are a market-expansion strategy advisor. Be explicit that all figures are modeled on synthetic demo data, not real market measurements.'
