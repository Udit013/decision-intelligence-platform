/**
 * Root-cause decomposition — attributes a KPI change to dimension members
 * (e.g. which categories or countries drove a revenue move). Ported & generalized
 * from retail's rootcause engine. Pure function over current-vs-prior totals.
 */

export interface DimMember {
  name: string
  current: number
  prior: number
}

export interface Driver {
  dimension: string
  name: string
  current: number
  prior: number
  change: number
  /** share of the total change attributable to this member (can exceed 100% if offsetting) */
  contributionPct: number
}

export interface RootCauseResult {
  changePct: number
  totalCurrent: number
  totalPrior: number
  topDriver: string | null
  topDrag: string | null
  drivers: Driver[]
  summary: string
  recommendations: string[]
}

/** Rank dimension members by absolute contribution to the total change. */
export function rankDrivers(dimension: string, members: DimMember[], totalChange: number, topN = 6): Driver[] {
  return members
    .map((m) => {
      const change = m.current - m.prior
      return {
        dimension,
        name: m.name,
        current: m.current,
        prior: m.prior,
        change,
        contributionPct: totalChange !== 0 ? Math.round((change / Math.abs(totalChange)) * 1000) / 10 : 0,
      }
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, topN)
}

export interface AssembleInput {
  metricLabel: string
  categories: DimMember[]
  countries?: DimMember[]
}

export function assembleRootCause(inp: AssembleInput): RootCauseResult {
  const totalCurrent = inp.categories.reduce((s, m) => s + m.current, 0)
  const totalPrior = inp.categories.reduce((s, m) => s + m.prior, 0)
  const change = totalCurrent - totalPrior
  const changePct = totalPrior !== 0 ? Math.round((change / totalPrior) * 1000) / 10 : 0

  const drivers = [
    ...rankDrivers('Category', inp.categories, change),
    ...(inp.countries ? rankDrivers('Country', inp.countries, change, 4) : []),
  ].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  const gains = drivers.filter((d) => d.change > 0)
  const drags = drivers.filter((d) => d.change < 0)
  const topDriver = gains[0]?.name ?? null
  const topDrag = drags[0]?.name ?? null

  const dir = change >= 0 ? 'up' : 'down'
  const summary = `${inp.metricLabel} is ${dir} ${Math.abs(changePct)}% vs the prior period (${Math.round(totalPrior).toLocaleString()} → ${Math.round(totalCurrent).toLocaleString()}).`

  const recommendations: string[] = []
  if (change < 0 && topDrag) recommendations.push(`Focus recovery on ${topDrag}, the largest drag on ${inp.metricLabel.toLowerCase()}.`)
  if (change >= 0 && topDriver) recommendations.push(`Reinvest behind ${topDriver}, the largest growth driver.`)
  if (drags.length && change >= 0) recommendations.push(`Watch ${drags[0].name}, which declined even as the total grew.`)
  if (!recommendations.length) recommendations.push('No single dimension dominates the change; investigate at a finer grain.')

  return { changePct, totalCurrent, totalPrior, topDriver, topDrag, drivers, summary, recommendations }
}
