'use client'

/**
 * Domain-level error boundary. A failed DB query or engine error renders a
 * branded, recoverable state instead of Next's default white error screen.
 */
import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

export default function DomainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for platform logs (Vercel captures console.error server+client).
    console.error('[domain-error]', error)
  }, [error])

  return (
    <div className="rounded-lg border border-bad/30 bg-bad/5 p-8 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-bad">Something went wrong</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        This view failed to load — most often a transient database hiccup. Your data is safe;
        retrying usually resolves it.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[10px] text-muted">ref: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  )
}
