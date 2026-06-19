import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDomain } from '@/core/registry'
import { DomainSwitcher } from '@/ui/components/DomainSwitcher'
import { ProvenanceBadge } from '@/ui/components/Badge'
import { Logo } from '@/ui/components/Logo'
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
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link href="/" className="hover:opacity-80">
            <Logo />
          </Link>
          <span className="text-border">/</span>
          <DomainSwitcher current={mod} />
          <div className="ml-auto">
            <ProvenanceBadge provenance={mod.provenance} source={mod.dataSource} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        <aside className="w-52 shrink-0">
          <DomainNav domainId={mod.id} items={mod.nav} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
