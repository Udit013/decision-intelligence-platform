import type { ComponentType } from 'react'
import { operationsPages } from './operations/pages'
import { marketPages } from './market/pages'
import { productPages } from './product/pages'

/**
 * Page registry: domainId → (nav slug → component). Domains that have their UI
 * wired register here; the app routes look a domain up and render its component,
 * falling back to the Phase-scaffold Placeholder for not-yet-built domains.
 */
/** Props every domain page receives (resolved URL search params). */
export interface DomainPageProps {
  searchParams: Record<string, string | string[] | undefined>
}
type DomainPage = ComponentType<DomainPageProps>

export const DOMAIN_PAGES: Record<string, Record<string, DomainPage>> = {
  operations: operationsPages,
  market: marketPages,
  product: productPages,
}

export function resolvePage(domainId: string, slug: string): DomainPage | undefined {
  return DOMAIN_PAGES[domainId]?.[slug]
}
