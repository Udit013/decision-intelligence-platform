import { createElement } from 'react'
import { notFound } from 'next/navigation'
import { getDomain } from '@/core/registry'
import { resolvePage } from '@/domains/pages'
import { Placeholder } from '../Placeholder'

// Operations reads ~1M rows from Postgres per request; give the serverless
// function headroom over the 10s default so a cold start can't time out.
export const maxDuration = 30

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; slug: string[] }>
}) {
  const { domain, slug } = await params
  const mod = getDomain(domain)
  const navItem = mod?.nav.find((n) => n.slug === slug[0])
  if (!mod || !navItem) return {}
  return { title: `${navItem.label} · ${mod.label} · CoreSight IQ`, description: mod.tagline }
}

const PHASE: Record<string, string> = {
  market: 'Phase 3',
  product: 'Phase 4',
}

export default async function DomainSubPage({
  params,
}: {
  params: Promise<{ domain: string; slug: string[] }>
}) {
  const { domain, slug } = await params
  const mod = getDomain(domain)
  if (!mod) notFound()

  // Only known nav slugs are valid pages.
  const first = slug[0]
  const navItem = mod.nav.find((n) => n.slug === first)
  if (!navItem) notFound()

  const page = resolvePage(mod.id, first)
  if (page) return createElement(page)

  return <Placeholder title={navItem.label} tagline={mod.tagline} phase={PHASE[mod.id] ?? 'a later phase'} />
}
