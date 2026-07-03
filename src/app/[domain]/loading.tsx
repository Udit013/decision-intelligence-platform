/**
 * Route-level loading skeleton. Matters most for Operations, whose first
 * (uncached) load runs real aggregate queries over ~1M rows (~4–5s cold): the
 * user sees an immediate, layout-stable skeleton instead of a frozen screen.
 */
export default function DomainLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics…</span>
      {/* Page header */}
      <div className="h-7 w-56 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-2" />

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="mt-6 rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="space-y-3 px-5 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border bg-surface-2/50 p-4">
              <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface-2" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-surface-2" />
              <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
