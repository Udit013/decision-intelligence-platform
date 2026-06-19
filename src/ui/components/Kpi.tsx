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
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">No data</p>
        <p className="mt-2 text-sm text-muted">
          The operations database is empty or unreachable. Set <code className="font-mono">DATABASE_URL</code>, then run:
        </p>
        <pre className="mx-auto mt-3 w-fit rounded-md border border-border bg-surface-2 px-4 py-2 text-left font-mono text-xs text-fg">
          npm run db:push{'\n'}npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
        </pre>
      </CardBody>
    </Card>
  )
}
