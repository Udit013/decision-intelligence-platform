import { createElement } from 'react'
import { notFound } from 'next/navigation'
import { getDomain } from '@/core/registry'
import { resolvePage } from '@/domains/pages'
import { Placeholder } from './Placeholder'

// Operations reads ~1M rows from Postgres per request; give the serverless
// function headroom over the 10s default so a cold start can't time out.
export const maxDuration = 30

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const mod = getDomain(domain)
  if (!mod) return {}
  return { title: `${mod.label} · CoreSight IQ`, description: mod.tagline }
}

const PHASE: Record<string, string> = {
  market: 'Phase 3',
  product: 'Phase 4',
}

export default async function DomainHome({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const mod = getDomain(domain)
  if (!mod) notFound()

  const page = resolvePage(mod.id, '')
  if (page) return createElement(page)

  const home = mod.nav[0]
  return <Placeholder title={home.label} tagline={mod.tagline} phase={PHASE[mod.id] ?? 'a later phase'} />
}
