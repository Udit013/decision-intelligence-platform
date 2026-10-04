import Link from 'next/link'
import type { DomainKey } from '@/core/tenancy'
import { kindsForDomain } from '@/domains/import-kinds'
import { ModeButton } from './ModeButton'
import { cn } from '@/ui/cn'

/**
 * Headline figures — one connected strip divided by hairlines (a single card,
 * not four floating ones). Values are display-face tabular numerals; labels are
 * quiet small-caps. Estimated figures carry an explicit "≈ est" mark — the
 * platform never passes a model off as a measurement.
 */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {children}
    </div>
  )
}

export function Kpi({
  label,
  value,
  sub,
  estimate,
}: {
  label: string
  value: string
  sub?: string
  estimate?: boolean
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="kicker">
        {label}
        {estimate && <span className="ml-1.5 normal-case tracking-normal text-warn">≈ est</span>}
      </p>
      <p className="mt-2.5 font-display text-[26px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {sub && <p className={cn('mt-2 text-xs text-muted')}>{sub}</p>}
    </div>
  )
}

/** Page header — display headline with a quiet supporting line; air, not rules. */
export function PageHeader({ title, tagline }: { title: string; tagline?: string }) {
  return (
    <header className="mb-7">
      <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
      {tagline && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{tagline}</p>}
    </header>
  )
}

/** Shown when a module has nothing to display for the current data choice. */
export function EmptyState({ domain = 'operations' }: { domain?: DomainKey }) {
  const kinds = kindsForDomain(domain)
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-12">
      <div className="mx-auto max-w-lg text-center">
        <p className="kicker text-[var(--accent)]">No data yet</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          You&apos;re viewing your own data, and nothing has been imported for this module. Upload a CSV, Excel or
          JSON file in the data manager and import it as:
        </p>
      </div>
      <ul className="mx-auto mt-5 max-w-lg divide-y divide-border border-y border-border text-left">
        {kinds.map((k) => (
          <li key={k.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-medium">{k.label}</span>
              <a href={k.template} className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted underline decoration-border underline-offset-4 hover:text-fg">
                template.csv
              </a>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              Needs {k.fields.filter((f) => f.required).map((f) => f.label).join(', ')}.
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/data" className="btn-ink">
          Upload data
        </Link>
        <ModeButton domain={domain} mode="demo">
          View sample data
        </ModeButton>
      </div>
    </div>
  )
}
