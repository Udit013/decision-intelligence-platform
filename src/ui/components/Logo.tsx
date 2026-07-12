import { cn } from '@/ui/cn'

/**
 * CoreSight IQ mark + wordmark. The mark is an ink tile with a paper sight-line
 * cross and a core dot — set like a printer's ornament, not an app icon.
 * The wordmark is serif ("the journal") with a mono "IQ" block.
 */
export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
        <rect width="20" height="20" fill="#1d1a14" />
        <path d="M10 3v4.4M10 12.6V17M3 10h4.4M12.6 10H17" stroke="#f2efe7" strokeWidth="1.1" />
        <circle cx="10" cy="10" r="2.1" fill="#f2efe7" />
        <circle cx="10" cy="10" r="1" fill="#1d1a14" />
      </svg>
      {showWord && (
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-[17px] font-medium leading-none tracking-[-0.01em] text-fg">
            CoreSight
          </span>
          <span className="border border-fg px-1 py-px font-mono text-[9px] font-semibold leading-none tracking-[0.08em] text-fg">
            IQ
          </span>
        </span>
      )}
    </span>
  )
}
