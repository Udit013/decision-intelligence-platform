/**
 * Experimentation intelligence — A/B significance via the SHARED core/stats engine
 * (calculateABTest → the merged canonical two-proportion z-test, p-value, CI). No
 * domain re-implementation of the statistics.
 */
import { calculateABTest, type ABTestResult } from '@/core/stats'

interface RawExperiment {
  name: string
  hypothesis: string
  controlConversions: number
  controlSamples: number
  treatmentConversions: number
  treatmentSamples: number
}

// Deterministic synthetic experiments (DEMO).
const RAW: RawExperiment[] = [
  { name: 'Onboarding checklist v2', hypothesis: 'A guided checklist lifts activation.', controlConversions: 642, controlSamples: 4000, treatmentConversions: 770, treatmentSamples: 4000 },
  { name: 'Pricing page redesign', hypothesis: 'Clearer tiers lift paid conversion.', controlConversions: 121, controlSamples: 3000, treatmentConversions: 134, treatmentSamples: 3000 },
  { name: 'AI Search promo banner', hypothesis: 'Promoting AI Search lifts feature adoption.', controlConversions: 880, controlSamples: 5000, treatmentConversions: 1180, treatmentSamples: 5000 },
  { name: 'Email re-engagement cadence', hypothesis: 'A 3-touch cadence reduces churn.', controlConversions: 410, controlSamples: 2500, treatmentConversions: 432, treatmentSamples: 2500 },
  { name: 'Mobile push nudges', hypothesis: 'Push nudges lift D7 retention.', controlConversions: 1500, controlSamples: 6000, treatmentConversions: 1470, treatmentSamples: 6000 },
]

export interface ExperimentResult extends RawExperiment {
  stats: ABTestResult
}

export function getExperiments(): ExperimentResult[] {
  return RAW.map((e) => ({
    ...e,
    stats: calculateABTest(e.controlConversions, e.controlSamples, e.treatmentConversions, e.treatmentSamples),
  }))
}
