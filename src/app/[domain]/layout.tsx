import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { UploadCloud } from 'lucide-react'
import { getDomain } from '@/core/registry'
import { DomainSwitcher } from '@/ui/components/DomainSwitcher'
import { ProvenanceBadge } from '@/ui/components/Badge'
import { Logo } from '@/ui/components/Logo'
import { DatasetStatus } from '@/ui/components/DatasetStatus'
import { DomainNav } from './DomainNav'

const ACCENT_HEX = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  lime: 'var(--color-lime)',
} as const

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
    // Per-domain accent: every accent-driven component reads --accent.
    <div style={{ ['--accent' as string]: ACCENT_HEX[mod.accent] }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link href="/" className="hover:opacity-80">
            <Logo />
          </Link>
          <span className="text-border">/</span>
          <DomainSwitcher current={mod} />
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/data"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Upload / Manage Data</span>
              <span className="sm:hidden">Data</span>
            </Link>
            <ProvenanceBadge provenance={mod.provenance} source={mod.dataSource} />
          </div>
        </div>
      </header>

      {/* Sidebar on lg+; horizontal scrollable nav bar on mobile. */}
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:py-8">
        <aside className="w-full shrink-0 lg:w-52">
          <DomainNav domainId={mod.id} items={mod.nav} />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {/* Streams in after the page; fails soft without a DB. */}
          <Suspense fallback={null}>
            <div className="mb-4">
              <DatasetStatus domain={mod.id} />
            </div>
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  )
}
