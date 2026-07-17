import Link from 'next/link'
import { DOMAINS } from '@/core/registry'
import { ProvenanceBadge } from '@/ui/components/Badge'
import { Logo } from '@/ui/components/Logo'
import { ACCENT_HEX } from '@/ui/accents'


/* Published figures — real, verified numbers from this repository (the platform's
 * thesis is that it prints its actual results, including the unflattering ones). */
const FIGURES = [
  { value: '1,067,371', label: 'real transactions', note: 'UCI Online Retail II' },
  { value: '0.072', label: 'honest weekly R²', note: 'walk-forward, out-of-sample' },
  { value: '105', label: 'unit tests', note: 'engine + domains' },
  { value: '120', label: 'modeled markets', note: 'was “121” — we recounted' },
]

const PIPELINE = [
  { name: 'Ingest', desc: 'Real or labeled synthetic data, in-app upload or CLI ETL with a pre-seed quality report.' },
  { name: 'Score', desc: 'One weighted multi-criteria engine ranks and classifies — the same primitive in all three modules.' },
  { name: 'Recommend', desc: 'Signals become ranked decisions, priced by impact × confidence, with the evidence attached.' },
  { name: 'Report', desc: 'One-click executive PDF with the honest accuracy figures printed on it.' },
  { name: 'Advise', desc: 'A local-first analyst (Ollama, deterministic fallback) grounded in the live numbers.' },
]

const DATA_DOCS: Record<string, string> = {
  operations: '~1.07M real UK e-commerce transactions (2009–2011). One-time ETL, or upload order lines in-app.',
  market: '120 synthetic markets with realistic economic indicators. Zero setup — in-memory.',
  product: '3,000 synthetic SaaS users with events, funnels & cohorts. Zero setup — in-memory.',
}

const STEPS = [
  { t: 'Pick a module', d: 'Operations, Market, or Product — from the contents at right or the tabs inside.' },
  { t: 'Read the decision desk', d: 'Each module opens on ranked, confidence-scored decisions; the index drills into forecasts, segments, funnels, and scenarios.' },
  { t: 'Export or interrogate', d: 'Download the executive PDF, or ask the advisor in plain English — it answers from the live figures.' },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]">
            <Link href="/data" className="underline decoration-border underline-offset-4 hover:decoration-fg">
              Data manager
            </Link>
            <a
              href="https://github.com/Udit013/decision-intelligence-platform"
              className="underline decoration-border underline-offset-4 hover:decoration-fg"
            >
              Source ↗
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* ── Front page: statement + contents, deliberately asymmetric ── */}
        <section className="grid gap-10 border-b border-border py-14 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p className="kicker">Decision intelligence · three modules · one engine</p>
            <h1 className="mt-4 font-display text-[clamp(34px,5vw,52px)] font-medium leading-[1.06] tracking-[-0.015em]">
              Ranked decisions,
              <br />
              with the accuracy
              <br />
              <span className="text-[var(--color-cyan)]">printed on them.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              CoreSight IQ turns operations, market, and product data into confidence-scored
              recommendations — forecasting with walk-forward backtesting, multi-criteria scoring,
              executive reporting, and a local-AI analyst. Every figure it shows is measured, labeled,
              or honestly disclaimed.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/operations" className="btn-ink">
                Open the platform
              </Link>
              <Link href="/data" className="btn-line">
                Upload data
              </Link>
            </div>
          </div>

          {/* Contents — numbered module index */}
          <div className="lg:col-span-5">
            <p className="kicker border-t border-border pt-4">Contents</p>
            <ol className="mt-1">
              {DOMAINS.map((d, i) => (
                <li key={d.id} className="border-b border-border">
                  <Link
                    href={`/${d.id}`}
                    className="group -mx-3 flex gap-4 rounded-xl px-3 py-4 transition-all hover:bg-surface hover:shadow-card"
                    style={{ ['--m' as string]: ACCENT_HEX[d.accent] }}
                  >
                    <span className="font-mono text-[11px] font-medium text-[color:var(--m)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-[19px] font-medium leading-tight">{d.label}</span>
                        <ProvenanceBadge provenance={d.provenance} source={d.dataSource} />
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-muted">{d.tagline}</span>
                      <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted/80">
                        {DATA_DOCS[d.id]}
                      </span>
                    </span>
                    <span className="self-center font-mono text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Published figures ── */}
        <section aria-label="Published figures" className="grid grid-cols-2 divide-border border-b border-border sm:grid-cols-4 sm:divide-x">
          {FIGURES.map((f) => (
            <div key={f.label} className="px-1 py-6 sm:px-6 sm:first:pl-0">
              <p className="font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums">{f.value}</p>
              <p className="kicker mt-2">{f.label}</p>
              <p className="mt-1 text-[11px] text-muted">{f.note}</p>
            </div>
          ))}
        </section>

        {/* ── Method ── */}
        <section className="grid gap-10 border-b border-border py-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="kicker">Method</p>
            <h2 className="mt-3 font-display text-[26px] font-medium leading-tight">
              One pipeline, proven three times.
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Every module runs the same five stages on one shared engine — the abstraction that lets
              genuinely different problems share forecasting, scoring, and reporting code.
            </p>
          </div>
          <ol className="lg:col-span-8">
            {PIPELINE.map((s, i) => (
              <li key={s.name} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-border py-4 first:border-t first:border-t-border sm:grid-cols-[3rem_10rem_1fr]">
                <span className="font-mono text-[11px] font-medium text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-[17px] font-medium leading-tight">{s.name}</span>
                <span className="col-span-2 mt-1 text-[13px] leading-relaxed text-muted sm:col-span-1 sm:mt-0">{s.desc}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Honest numbers note + getting started ── */}
        <section className="grid gap-10 border-b border-border py-14 lg:grid-cols-12">
          <figure className="lg:col-span-5">
            <blockquote className="rounded-r-xl border-l-2 border-[var(--color-cyan)] bg-surface py-4 pl-5 pr-5 shadow-card">
              <p className="font-display text-[18px] font-medium leading-snug">
                “On this spiky real series the forecast barely beats a naive mean — R² ≈ 0.07. The old
                claim of 0.90 was never reproduced, so it isn&apos;t here.”
              </p>
            </blockquote>
            <figcaption className="kicker mt-3 pl-5">
              From the validation harness — reproducible via{' '}
              <code className="normal-case">scripts/harness-demo.ts</code>
            </figcaption>
          </figure>

          <div className="lg:col-span-7">
            <p className="kicker">Getting started</p>
            <ol className="mt-2 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.t} className="border-t border-border pt-3">
                  <span className="font-mono text-[11px] font-medium text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-1.5 text-sm font-semibold">{s.t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-[13px] text-muted">
              Bring your own data: CSV, XLSX, JSON, TXT, PDF, or DOCX — uploaded once, shared across
              modules.{' '}
              <Link href="/data" className="font-medium text-fg underline decoration-border underline-offset-4 hover:decoration-fg">
                Open the Data Manager
              </Link>
              , or see the{' '}
              <a
                href="https://github.com/Udit013/decision-intelligence-platform#setup"
                className="font-medium text-fg underline decoration-border underline-offset-4 hover:decoration-fg"
              >
                README
              </a>{' '}
              for the CLI ETL.
            </p>
          </div>
        </section>
      </main>

      {/* ── Colophon ── */}
      <footer>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Operations on real data · Market &amp; Product on labeled synthetic data · MIT
          </p>
        </div>
      </footer>
    </div>
  )
}
