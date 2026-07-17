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
    <div className="rounded-xl border border-bad/25 bg-bad/[0.04] px-6 py-10 text-center">
      <p className="kicker text-bad">Something went wrong</p>
      <p className="mx-auto mt-3 max-w-md font-display text-xl font-medium leading-snug">
        This view failed to load.
      </p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">
        Most often a transient database hiccup — your data is safe, and retrying usually resolves it.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[10px] text-muted">ref: {error.digest}</p>}
      <button onClick={reset} className="btn-ink mt-6">
        <RotateCcw className="h-3.5 w-3.5" /> Try again
      </button>
    </div>
  )
}
