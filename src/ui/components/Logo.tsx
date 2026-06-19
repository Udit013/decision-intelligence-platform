import { cn } from '@/ui/cn'

/** CoreSight IQ wordmark + mark. The mark is a "sight/lens" ring over a core dot. */
export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <rect width="24" height="24" rx="6" fill="#0f172a" />
        <circle cx="12" cy="12" r="6.5" stroke="#22d3ee" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.4" fill="#a3e635" />
        <circle cx="12" cy="12" r="9.2" stroke="#7c3aed" strokeWidth="1.2" strokeOpacity="0.55" />
      </svg>
      {showWord && (
        <span className="text-sm font-semibold tracking-tight text-fg">
          CoreSight <span className="text-[var(--accent)]">IQ</span>
        </span>
      )}
    </span>
  )
}
