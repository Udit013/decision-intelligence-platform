/**
 * SYNTHETIC product-analytics generator — DEMO DATA, in-memory & deterministic.
 *
 * ⚠️ Ported in spirit from productlab's seed (which wrote 10k users / 100k events to
 * Postgres). Here it's a smaller, deterministic in-memory dataset so the domain
 * renders with zero setup and so retention can be MEASURED from what is actually
 * generated (no hardcoded D1–D90 figures — see ./retention.ts + config.ts).
 */

export interface ProductUser {
  id: string
  plan: 'free' | 'starter' | 'growth' | 'enterprise'
  country: string
  role: string
  signupDate: Date
  cohortKey: string // signup month YYYY-MM
  /** Day-offsets after signup on which the user had a session (for retention). */
  activeOffsets: number[]
  reachedOnboarding: boolean
  activated: boolean
  usedFeature: boolean
  purchased: boolean
  featuresUsed: string[]
}

export interface ProductFeature {
  name: string
  slug: string
  category: string
  isCore: boolean
}

export const FEATURES: ProductFeature[] = [
  { name: 'AI Search', slug: 'ai-search', category: 'core', isCore: false },
  { name: 'Dashboard', slug: 'dashboard', category: 'core', isCore: true },
  { name: 'Reports', slug: 'reports', category: 'analytics', isCore: true },
  { name: 'Team Collaboration', slug: 'team-collab', category: 'collaboration', isCore: false },
  { name: 'API Access', slug: 'api-access', category: 'developer', isCore: false },
  { name: 'Data Export', slug: 'data-export', category: 'analytics', isCore: false },
  { name: 'Custom Dashboards', slug: 'custom-dashboards', category: 'analytics', isCore: false },
  { name: 'Notifications', slug: 'notifications', category: 'engagement', isCore: true },
  { name: 'Integrations', slug: 'integrations', category: 'developer', isCore: false },
  { name: 'Mobile App', slug: 'mobile-app', category: 'platform', isCore: false },
  { name: 'Advanced Filters', slug: 'advanced-filters', category: 'analytics', isCore: false },
  { name: 'Automation Rules', slug: 'automation-rules', category: 'productivity', isCore: false },
]

const PLANS: ProductUser['plan'][] = ['free', 'starter', 'growth', 'enterprise']
const PLAN_WEIGHTS = [0.45, 0.3, 0.17, 0.08]
const COUNTRIES = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IN', 'SG', 'BR', 'NL']
const ROLES = ['Product Manager', 'Engineer', 'Designer', 'Analyst', 'Founder', 'Marketing']
const RETENTION_OFFSETS = [0, 1, 7, 14, 30, 60, 90]

// Base day-0→day-d retention propensity by plan (higher plans retain better).
const PLAN_RETENTION: Record<ProductUser['plan'], number> = { free: 0.55, starter: 0.7, growth: 0.82, enterprise: 0.9 }
// Funnel step pass-through probabilities by plan.
const PLAN_ACTIVATION: Record<ProductUser['plan'], number> = { free: 0.5, starter: 0.65, growth: 0.78, enterprise: 0.88 }

function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, arr: T[], weights?: number[]): T {
  if (!weights) return arr[Math.floor(rand() * arr.length)]
  const r = rand()
  let cum = 0
  for (let i = 0; i < arr.length; i++) {
    cum += weights[i]
    if (r < cum) return arr[i]
  }
  return arr[arr.length - 1]
}

const N_USERS = 3000
const NOW = new Date('2024-12-31')
const WINDOW_DAYS = 300 // signups spread over ~10 months so 90-day windows exist

let _users: ProductUser[] | null = null

export function generateUsers(): ProductUser[] {
  if (_users) return _users
  const rand = mulberry32(1337)
  const users: ProductUser[] = []

  for (let i = 0; i < N_USERS; i++) {
    const plan = pick(rand, PLANS, PLAN_WEIGHTS)
    const daysAgo = Math.floor(rand() * WINDOW_DAYS)
    const signupDate = new Date(NOW.getTime() - daysAgo * 86400000)
    const cohortKey = `${signupDate.getUTCFullYear()}-${String(signupDate.getUTCMonth() + 1).padStart(2, '0')}`

    // Retention: active on day 0 always; day d with prob base·exp(-d/tau).
    const base = PLAN_RETENTION[plan]
    const tau = 28 + base * 30
    const activeOffsets = RETENTION_OFFSETS.filter((d) => d === 0 || rand() < base * Math.exp(-d / tau))

    // Funnel — each step gated on the previous.
    const act = PLAN_ACTIVATION[plan]
    const reachedOnboarding = rand() < 0.86
    const activated = reachedOnboarding && rand() < act
    const usedFeature = activated && rand() < 0.8
    const purchased = usedFeature && plan !== 'free' && rand() < 0.55

    const featuresUsed: string[] = []
    if (usedFeature) {
      const n = 1 + Math.floor(rand() * 5)
      for (let k = 0; k < n; k++) {
        // Core features get used more often (bias the pick toward the front).
        const idx = Math.floor(rand() * rand() * FEATURES.length)
        const f = FEATURES[idx].slug
        if (!featuresUsed.includes(f)) featuresUsed.push(f)
      }
    }

    users.push({ id: `u${i}`, plan, country: pick(rand, COUNTRIES), role: pick(rand, ROLES), signupDate, cohortKey, activeOffsets, reachedOnboarding, activated, usedFeature, purchased, featuresUsed })
  }

  _users = users
  return users
}

export const USER_COUNT = generateUsers().length
export { RETENTION_OFFSETS }
