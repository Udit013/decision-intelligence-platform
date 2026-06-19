/**
 * Opportunity discovery — surfaces product signals from the synthetic analytics
 * (low-adoption core features, the biggest funnel drop-off, weak retention).
 * DEMO data; scores are modeled.
 */
import { buildAdoption, buildFunnel, buildRetention } from './analytics'
import { USER_COUNT } from './generator'

export interface ProductOpportunity {
  id: string
  type: 'High demand · low adoption' | 'Funnel drop-off' | 'Retention risk'
  title: string
  description: string
  score: number
  affectedUsers: number
}

export function discoverOpportunities(): ProductOpportunity[] {
  const out: ProductOpportunity[] = []

  // Core features with weak adoption.
  for (const f of buildAdoption().filter((a) => a.isCore && a.adoptionPct < 40)) {
    out.push({
      id: `adopt-${f.slug}`,
      type: 'High demand · low adoption',
      title: `${f.name} is core but under-adopted (${f.adoptionPct}%)`,
      description: `Only ${f.adoptionPct}% of users have used ${f.name}, a core feature. Surface it in onboarding.`,
      score: Math.round(70 + (40 - f.adoptionPct)),
      affectedUsers: Math.round(USER_COUNT * (1 - f.adoptionPct / 100)),
    })
  }

  // Biggest funnel drop-off.
  const { steps } = buildFunnel()
  let worst = { from: '', to: '', drop: 0, idx: 0 }
  for (let i = 1; i < steps.length; i++) {
    const drop = 100 - steps[i].conversionFromPrev
    if (drop > worst.drop) worst = { from: steps[i - 1].step, to: steps[i].step, drop, idx: i }
  }
  if (worst.drop > 0) {
    out.push({
      id: 'funnel-drop',
      type: 'Funnel drop-off',
      title: `${worst.drop}% drop: ${worst.from} → ${worst.to}`,
      description: `The largest funnel leak is between "${worst.from}" and "${worst.to}". Fixing it compounds downstream.`,
      score: Math.round(60 + worst.drop * 0.4),
      affectedUsers: steps[worst.idx - 1].users - steps[worst.idx].users,
    })
  }

  // Retention risk (low D30).
  const d30 = buildRetention().pooled.find((p) => p.offset === 30)?.ratePct ?? 0
  if (d30 < 40) {
    out.push({
      id: 'retention-d30',
      type: 'Retention risk',
      title: `D30 retention is ${d30}%`,
      description: `Measured D30 retention is ${d30}% — below a healthy bar. Invest in habit-forming loops and re-engagement.`,
      score: Math.round(65 + (40 - d30)),
      affectedUsers: Math.round(USER_COUNT * (1 - d30 / 100)),
    })
  }

  return out.sort((a, b) => b.score - a.score)
}
