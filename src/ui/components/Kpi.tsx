import Link from 'next/link'
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

/** Shown when the operations DB has no data yet. */
export function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
      <p className="kicker text-[var(--accent)]">No data yet</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        This module has no data loaded. Upload a transactions file (CSV/XLSX/JSON with invoice, SKU,
        quantity, price, and date columns) and it powers these analytics directly.
      </p>
      <Link href="/data" className="btn-ink mt-6">
        Upload data
      </Link>
      <p className="mt-7 text-xs text-muted">
        Or load the full UCI Online Retail II dataset (~1M rows) from the CLI:
      </p>
      <pre className="mx-auto mt-2 w-fit rounded-lg border border-border bg-surface-2/70 px-4 py-2.5 text-left font-mono text-xs text-fg">
        npm run db:push{'\n'}npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
      </pre>
    </div>
  )
}
