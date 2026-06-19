import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DOMAINS } from '@/core/registry'
import { Card, CardBody } from '@/ui/components/Card'
import { ProvenanceBadge } from '@/ui/components/Badge'

const ACCENT_HEX = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  lime: 'var(--color-lime)',
} as const

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        Decision Intelligence Platform
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight">
        One engine. Three domains. Decisions, not dashboards.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        A shared core — forecasting with holdout backtesting, multi-criteria scoring, a
        recommendation synthesizer, a validation harness, PDF reports, and a local-AI advisor —
        powers three pluggable domains.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {DOMAINS.map((d) => (
          <Link key={d.id} href={`/${d.id}`} className="group">
            <Card className="h-full transition-colors group-hover:border-[color:var(--c)]" style={{ ['--c' as string]: ACCENT_HEX[d.accent] }}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: ACCENT_HEX[d.accent] }}
                  />
                  <ProvenanceBadge provenance={d.provenance} source={d.dataSource} />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{d.label}</h2>
                <p className="mt-1 text-sm text-muted">{d.tagline}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-xs font-mono text-muted group-hover:text-fg">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
