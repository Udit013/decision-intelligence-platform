import Link from 'next/link'

/**
 * Provenance notice — states that a module is showing the synthetic sample, and
 * points to where your own data goes. Quiet, but always present in demo mode.
 */
export function DemoBanner({ note }: { note: string }) {
  return (
    <aside className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 rounded-xl border border-warn/20 bg-warn/[0.06] px-4 py-3.5">
      <div className="min-w-0 max-w-3xl">
        <p className="kicker text-warn">Sample data · modeled</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg/85">{note}</p>
      </div>
      <Link href="/data" className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-fg underline decoration-warn/50 underline-offset-4 hover:decoration-fg">
        Use your own data →
      </Link>
    </aside>
  )
}
