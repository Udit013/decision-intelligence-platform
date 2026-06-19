/**
 * ════════════════════════════════════════════════════════════════════════════
 *  PRODUCT — provenance & measured notes
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ DEMO DATA. In-memory synthetic generator (3,000 users), deterministic
 *  (seed 1337), no database. The UI labels this "DEMO DATA / MODELED" at the top
 *  level via DemoBanner.
 *
 *  RETENTION — MEASURED from the generated data via core/cohort (NOT hardcoded):
 *    D1 65.8% · D7 57.9% · D14 49.5% · D30 35.6% · D60 20.5% · D90 10.2%
 *  (Reproduce: `npx tsx scripts/product-metrics.ts`. The UI computes these live,
 *  so they always reflect the generator — no flattering constant is displayed.)
 *
 *  FUNNEL — measured: Signup 100% → Onboarding 87% → Activated 55.3% →
 *    Used a feature 43.9% → Purchased 14.2%.
 *
 *  EXPERIMENTS — A/B via core/stats (one canonical normalCDF in the codebase).
 *  Of 5 synthetic tests, 2 are significant winners and 3 are inconclusive — we
 *  show the honest verdicts (p-values), not "all wins".
 *
 *  PRIORITIZATION — RICE/ICE/WSJF formulas are standard; the RANK + Now/Next/
 *  Later/Backlog tiering goes through core/scoreAndClassify (single-criterion
 *  config), the same primitive Market uses for Expand/Investigate/Monitor/Avoid.
 *
 *  SEGMENTS — engagement quintiles via core/segmentation (equal-sized by
 *  construction; the differentiator is avg features used per tier).
 * ════════════════════════════════════════════════════════════════════════════
 */
import { USER_COUNT } from './generator'

export const PRODUCT_META = {
  brand: 'CoreSight IQ',
  reportTitle: 'Product — Executive Report',
  accentRgb: [77, 124, 15] as [number, number, number],
  userCount: USER_COUNT,
  demoNote: `Demo data: ${USER_COUNT} synthetic users (deterministic, in-memory). Retention, funnel, and adoption are MEASURED from the generated data; experiment stats use the shared core/stats A/B engine.`,
}

export const ADVISOR_PERSONA =
  'You are a product analytics advisor. Be explicit that the data is synthetic demo data, but that retention/funnel figures are measured from it (not invented).'
