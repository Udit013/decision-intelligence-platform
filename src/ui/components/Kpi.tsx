import Link from 'next/link'
import { cn } from '@/ui/cn'

/**
 * Figures ledger — headline numbers set as one ruled strip divided by
 * hairlines, not four identical floating cards. Values are tabular mono;
 * labels are small-caps kickers. Estimated figures carry an explicit "≈ est"
 * mark (the platform never passes a model off as a measurement).
 */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-border border-t-2 border-t-fg bg-border lg:grid-cols-4">
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
    <div className="bg-surface px-4 py-4">
      <p className="kicker">
        {label}
        {estimate && <span className="ml-1.5 normal-case tracking-normal text-warn">≈ est</span>}
      </p>
      <p className="mt-2 font-mono text-[26px] font-medium leading-none tracking-tight tabular-nums">{value}</p>
      {sub && <p className={cn('mt-2 text-xs text-muted')}>{sub}</p>}
    </div>
  )
}

/** Page header — serif display headline over a hairline, with a mono kicker rule. */
export function PageHeader({ title, tagline }: { title: string; tagline?: string }) {
  return (
    <header className="mb-6 border-b border-border pb-4">
      <h1 className="font-display text-[30px] font-medium leading-[1.1] tracking-[-0.01em]">{title}</h1>
      {tagline && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{tagline}</p>}
    </header>
  )
}

/** Shown when the operations DB has no data yet. */
export function EmptyState() {
  return (
    <div className="border border-border border-t-2 border-t-fg bg-surface px-6 py-12 text-center">
      <p className="kicker text-[var(--accent)]">No data yet</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        This module has no data loaded. Upload a transactions file (CSV/XLSX/JSON with invoice, SKU,
        quantity, price, and date columns) and it powers these analytics directly.
      </p>
      <Link href="/data" className="btn-ink mt-6">
        Upload data
      </Link>
      <p className="mt-6 text-xs text-muted">
        Or load the full UCI Online Retail II dataset (~1M rows) from the CLI:
      </p>
      <pre className="mx-auto mt-2 w-fit border border-border bg-surface-2 px-4 py-2 text-left font-mono text-xs text-fg">
        npm run db:push{'\n'}npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
      </pre>
    </div>
  )
}
