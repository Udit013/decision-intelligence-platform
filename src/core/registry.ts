/**
 * Domain registration contract.
 *
 * The whole point of the merge: /core owns the engine, and each /domain plugs in
 * by describing itself here rather than re-implementing forecasting, scoring,
 * recommendation, reporting, or the advisor. Phase 0 establishes the contract and
 * registers domain *metadata* (identity + navigation) so the shell, router, and
 * domain switcher work. Later phases attach the capability slots below
 * (dataset adapter, scoring config, signal providers, advisor context).
 */

export type DomainId = 'operations' | 'market' | 'product'

/** Whether a domain runs on genuine real-world data or labeled demo data. */
export type DataProvenance = 'real' | 'demo'

export interface DomainNavItem {
  /** Path segment under /[domain], e.g. "forecasting" → /operations/forecasting. */
  slug: string
  label: string
}

/**
 * Capability slots filled in by later phases. Kept optional so Phase 0 compiles
 * with metadata only. Each is a thin config/adapter that hands work to /core:
 *  - scoring:   weighted multi-criteria config consumed by core/scoring
 *  - signals:   produces Signal[] for core/recommend (the Decision synthesizer)
 *  - advisor:   builds the grounded context document for core/advisor
 *  - report:    supplies executive-report sections for core/report
 * The concrete types land with their /core modules in Phase 1; typed `unknown`
 * here to avoid forward-coupling the contract before those modules exist.
 */
export interface DomainCapabilities {
  scoring?: unknown
  signals?: unknown
  advisor?: unknown
  report?: unknown
}

export interface DomainModule extends DomainCapabilities {
  id: DomainId
  /** Display name in the switcher and headers. */
  label: string
  /** One-line description of the decision this domain answers. */
  tagline: string
  /** Semantic accent token (maps to a CSS variable in the design system). */
  accent: 'violet' | 'lime' | 'cyan'
  /** Honest provenance badge surfaced in-UI. */
  provenance: DataProvenance
  /** Human-readable data source label, shown next to the provenance badge. */
  dataSource: string
  /** Left-nav entries for this domain. */
  nav: DomainNavItem[]
}

/* ── Registered domains (metadata only in Phase 0) ──────────────────────────── */

export const OPERATIONS: DomainModule = {
  id: 'operations',
  label: 'Operations',
  tagline: 'Forecast demand, optimize inventory & pricing, find the root cause.',
  accent: 'cyan',
  provenance: 'real',
  dataSource: 'UCI Online Retail II (real transactions)',
  nav: [
    { slug: '', label: 'Decision Center' },
    { slug: 'forecasting', label: 'Forecasting' },
    { slug: 'customers', label: 'Customer Intelligence' },
    { slug: 'inventory', label: 'Inventory' },
    { slug: 'pricing', label: 'Pricing & Promo' },
    { slug: 'root-cause', label: 'Root Cause' },
    { slug: 'reports', label: 'Executive Reports' },
    { slug: 'advisor', label: 'AI Advisor' },
  ],
}

export const MARKET: DomainModule = {
  id: 'market',
  label: 'Market',
  tagline: 'Where to expand next: score markets, simulate entry, rank strategies.',
  accent: 'violet',
  provenance: 'demo',
  dataSource: 'Synthetic market generator (demo data)',
  nav: [
    { slug: '', label: 'Expansion Center' },
    { slug: 'markets', label: 'Market Intelligence' },
    { slug: 'competition', label: 'Competitive Intel' },
    { slug: 'opportunities', label: 'Opportunities' },
    { slug: 'scenarios', label: 'Scenario Simulator' },
    { slug: 'entry-strategy', label: 'Entry Strategy' },
    { slug: 'reports', label: 'Boardroom Reports' },
    { slug: 'advisor', label: 'AI Advisor' },
  ],
}

export const PRODUCT: DomainModule = {
  id: 'product',
  label: 'Product',
  tagline: 'What to build next: prioritize initiatives, analyze funnels & tests.',
  accent: 'lime',
  provenance: 'demo',
  dataSource: 'Synthetic event generator (demo data)',
  nav: [
    { slug: '', label: 'Decision Center' },
    { slug: 'opportunities', label: 'Opportunities' },
    { slug: 'prioritization', label: 'Prioritization' },
    { slug: 'analytics', label: 'Funnels & Cohorts' },
    { slug: 'experiments', label: 'Experiments' },
    { slug: 'roadmap', label: 'Roadmap' },
    { slug: 'reports', label: 'Executive Reports' },
    { slug: 'advisor', label: 'AI Advisor' },
  ],
}

/** The registry — order is the display order in the domain switcher. */
export const DOMAINS: DomainModule[] = [OPERATIONS, MARKET, PRODUCT]

export function getDomain(id: string): DomainModule | undefined {
  return DOMAINS.find((d) => d.id === id)
}

export function isDomainId(id: string): id is DomainId {
  return DOMAINS.some((d) => d.id === id)
}
