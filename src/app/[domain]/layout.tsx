import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDomain } from '@/core/registry'
import { ACCENT_HEX } from '@/ui/accents'
import { DomainSwitcher } from '@/ui/components/DomainSwitcher'
import { ProvenanceBadge } from '@/ui/components/Badge'
import { Logo } from '@/ui/components/Logo'
import { DatasetStatus } from '@/ui/components/DatasetStatus'
import { DomainNav } from './DomainNav'

export default async function DomainLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const mod = getDomain(domain)
  if (!mod) notFound()

  return (
    // Per-module accent: every accent-driven component reads --accent.
    <div style={{ ['--accent' as string]: ACCENT_HEX[mod.accent] }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Masthead: wordmark · module tabs · data + provenance. */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-0 px-4 sm:px-6">
          <Link href="/" className="py-3 transition-opacity hover:opacity-75">
            <Logo />
          </Link>
          <DomainSwitcher current={mod} />
          <div className="ml-auto flex items-center gap-3 py-3">
            <Link
              href="/data"
              className="hidden rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-muted/40 hover:bg-surface-2/60 sm:inline-flex"
            >
              Upload / manage data
            </Link>
            <ProvenanceBadge provenance={mod.provenance} source={mod.dataSource} />
          </div>
        </div>
      </header>

      {/* Statusline: streams in after the page; fails soft without a DB. */}
      <Suspense fallback={<div className="h-[29px] border-b border-border/70 bg-surface-2/40" />}>
        <DatasetStatus domain={mod.id} />
      </Suspense>

      {/* Index rail on lg+; horizontal index strip on mobile. */}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:flex-row lg:gap-12 lg:py-10">
        <aside className="w-full shrink-0 lg:w-48">
          <DomainNav domainId={mod.id} items={mod.nav} />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
