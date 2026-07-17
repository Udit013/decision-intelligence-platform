/**
 * Route-level loading skeleton, shaped like the ledger layout (figures strip +
 * ruled panel). Matters most for Operations, whose first uncached load runs
 * real aggregate queries over ~1M rows.
 */
export default function DomainLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics…</span>
      {/* Page header */}
      <div className="pb-4">
        <div className="h-8 w-64 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-2 h-3.5 w-96 max-w-full animate-pulse rounded-md bg-surface-2" />
      </div>

      {/* Figures ledger */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface px-5 py-4">
            <div className="h-2.5 w-16 animate-pulse rounded bg-surface-2" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded-md bg-surface-2" />
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="mt-6 rounded-xl border border-border bg-surface shadow-card">
        <div className="border-b border-border px-5 py-3">
          <div className="h-3 w-36 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-border py-4 last:border-b-0">
              <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-surface-2" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-surface-2" />
              <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
