import Link from 'next/link'
import { UploadCloud } from 'lucide-react'
import { Card, CardBody } from './Card'
import { cn } from '@/ui/cn'

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
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
    <Card>
      <CardBody>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {label}
          {estimate && <span className="ml-1 text-warn">~est</span>}
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className={cn('mt-1 text-xs text-muted')}>{sub}</p>}
      </CardBody>
    </Card>
  )
}

export function PageHeader({ title, tagline }: { title: string; tagline?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {tagline && <p className="mt-1 text-sm text-muted">{tagline}</p>}
    </div>
  )
}

/** Shown when the operations DB has no data yet. */
export function EmptyState() {
  return (
    <Card>
      <CardBody className="py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">No data yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          This module has no data loaded. Upload a transactions file (CSV/XLSX/JSON with invoice, SKU,
          quantity, price, and date columns) and it powers these analytics directly.
        </p>
        <Link
          href="/data"
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-5 py-2.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
        >
          <UploadCloud className="h-4 w-4" /> Upload Data
        </Link>
        <p className="mt-5 text-xs text-muted">
          Or load the full UCI Online Retail II dataset (~1M rows) from the CLI:
        </p>
        <pre className="mx-auto mt-2 w-fit rounded-md border border-border bg-surface-2 px-4 py-2 text-left font-mono text-xs text-fg">
          npm run db:push{'\n'}npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
        </pre>
      </CardBody>
    </Card>
  )
}
