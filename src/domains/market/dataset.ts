import 'server-only'
/**
 * Market dataset for the current visitor: the synthetic sample, their own
 * imported indicators + competitor shares, or empty (own data requested, none
 * imported). Pages and the advisor read through here so they always agree.
 */
import { unstable_cache } from 'next/cache'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { marketCompetitors, marketIndicators } from '@/db/schema'
import { resolveDataSource, type DataSource } from '@/server/workspace'
import { generateMarkets, generateCompetitiveData, generateOpportunities } from './generator'
import { marketsFromIndicators, competitiveFromShares, detectOpportunities } from './model'
import type { CompetitiveData, Market, Opportunity } from './types'

export interface MarketDataset {
  source: DataSource
  markets: Market[]
  competitive: CompetitiveData[]
  opportunities: Opportunity[]
  /** True when competitor shares exist (competition metrics are available). */
  hasCompetition: boolean
}

const loadWorkspace = (ws: string) =>
  unstable_cache(
    async () => {
      const db = getDb()
      const [ind, comp] = await Promise.all([
        db.select().from(marketIndicators).where(eq(marketIndicators.workspaceId, ws)),
        db
          .select({ marketKey: marketCompetitors.marketKey, competitor: marketCompetitors.competitor, marketSharePct: marketCompetitors.marketSharePct })
          .from(marketCompetitors)
          .where(eq(marketCompetitors.workspaceId, ws)),
      ])
      return { ind, comp }
    },
    ['market', ws],
    { revalidate: 3600, tags: [`ws:${ws}`] },
  )()

export async function getMarketDataset(): Promise<MarketDataset> {
  const source = await resolveDataSource('market')
  if (source.kind === 'demo') {
    return { source, markets: generateMarkets(), competitive: generateCompetitiveData(), opportunities: generateOpportunities(), hasCompetition: true }
  }
  if (source.kind === 'empty') return { source, markets: [], competitive: [], opportunities: [], hasCompetition: false }

  const { ind, comp } = await loadWorkspace(source.workspaceId)
  const markets = marketsFromIndicators(ind).sort((a, b) => a.name.localeCompare(b.name))
  const competitive = competitiveFromShares(markets, comp)
  return { source, markets, competitive, opportunities: detectOpportunities(markets, competitive), hasCompetition: competitive.length > 0 }
}
