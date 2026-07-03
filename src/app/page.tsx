import Link from 'next/link'
import { ArrowRight, Database, Upload, Sparkles, FileText, Bot, Layers } from 'lucide-react'
import { DOMAINS } from '@/core/registry'
import { Card, CardBody } from '@/ui/components/Card'
import { ProvenanceBadge } from '@/ui/components/Badge'
import { Logo } from '@/ui/components/Logo'

const ACCENT_HEX = { cyan: 'var(--color-cyan)', violet: 'var(--color-violet)', lime: 'var(--color-lime)' } as const

const PIPELINE = [
  { icon: Database, label: 'Ingest', desc: 'Real or synthetic domain data' },
  { icon: Layers, label: 'Score', desc: 'Multi-criteria, weighted & classified' },
  { icon: Sparkles, label: 'Recommend', desc: 'Ranked, confidence-scored decisions' },
  { icon: FileText, label: 'Report', desc: 'One-click executive PDF' },
  { icon: Bot, label: 'Advise', desc: 'Local-AI Q&A, grounded in the data' },
]

const DATA_DOCS: Record<string, { source: string; setup: string }> = {
  operations: { source: 'UCI “Online Retail II” — ~1M real UK e-commerce transactions (2009–2011).', setup: 'Needs a one-time ETL (DATABASE_URL → npm run db:push → ETL script).' },
  market: { source: '120 synthetic markets with realistic 2023–24-style economic indicators.', setup: 'Zero setup — runs in-memory, no database.' },
  product: { source: '3,000 synthetic SaaS users with events, funnels & cohorts.', setup: 'Zero setup — runs in-memory, no database.' },
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo />
          <a href="https://github.com/Udit013/decision-intelligence-platform" className="text-xs font-medium text-muted hover:text-fg">
            GitHub ↗
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Hero */}
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-good" /> One engine · three domains
        </span>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Decision intelligence, <span className="text-[var(--color-cyan)]">not dashboards</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          CoreSight IQ turns operations, market, and product data into ranked, confidence-scored
          decisions — powered by one shared analytics core: forecasting with honest backtesting,
          multi-criteria scoring, a recommendation synthesizer, PDF reports, and a local-AI advisor.
        </p>

        {/* Module cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {DOMAINS.map((d) => (
            <Link key={d.id} href={`/${d.id}`} className="group">
              <Card className="h-full shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md" style={{ ['--c' as string]: ACCENT_HEX[d.accent] }}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT_HEX[d.accent] }} />
                    <ProvenanceBadge provenance={d.provenance} source={d.dataSource} />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">{d.label}</h2>
                  <p className="mt-1 text-sm text-muted">{d.tagline}</p>
                  <p className="mt-3 text-xs text-muted">{DATA_DOCS[d.id]?.source}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--c)]">
                    Open module <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>

        {/* Pipeline */}
        <section className="mt-20">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">How it works</h2>
          <p className="mt-2 max-w-2xl text-muted">Every module follows the same five-step pipeline — the abstraction that lets one engine serve three very different problems.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {PIPELINE.map((s, i) => (
              <Card key={s.label}>
                <CardBody>
                  <s.icon className="h-5 w-5 text-[var(--color-cyan)]" />
                  <p className="mt-3 text-sm font-semibold">{i + 1}. {s.label}</p>
                  <p className="mt-1 text-xs text-muted">{s.desc}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* Getting started */}
        <section className="mt-20 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Getting started</h2>
            <ol className="mt-4 space-y-4">
              {[
                { t: 'Pick a module', d: 'Open Operations, Market, or Product from the cards above or the switcher in the header.' },
                { t: 'Explore the data', d: 'Each module opens on a Decision Center, then drill into forecasting, segments, funnels, scenarios and more from the left nav.' },
                { t: 'Generate a report or ask the advisor', d: 'Export a one-click executive PDF, or open the AI Advisor and ask in plain English — it answers grounded in the live numbers.' },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-cyan)]/12 text-xs font-semibold text-[var(--color-cyan)]">{i + 1}</span>
                  <div><p className="text-sm font-semibold">{s.t}</p><p className="text-sm text-muted">{s.d}</p></div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted"><Upload className="h-4 w-4" /> Datasets & adding data</h2>
            <div className="mt-4 space-y-3">
              {DOMAINS.map((d) => (
                <Card key={d.id}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{d.label}</span>
                      <ProvenanceBadge provenance={d.provenance} source={d.dataSource} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{DATA_DOCS[d.id]?.source}</p>
                    <p className="mt-1 text-xs text-muted"><span className="font-medium text-fg">Load:</span> {DATA_DOCS[d.id]?.setup}</p>
                  </CardBody>
                </Card>
              ))}
              <Link
                href="/data"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 px-4 py-2 text-sm font-semibold text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)]/20"
              >
                <Upload className="h-4 w-4" /> Open the Data Manager
              </Link>
              <p className="text-xs text-muted">Upload CSV/XLSX/JSON/TXT/PDF/DOCX once — shared across all modules. Full ETL & schema details in the <a className="text-[var(--color-cyan)] hover:underline" href="https://github.com/Udit013/decision-intelligence-platform#setup">README</a>.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted sm:flex-row">
          <Logo />
          <span>Operations on real data · Market & Product on labeled synthetic data · MIT licensed</span>
        </div>
      </footer>
    </div>
  )
}
