import { cn } from '@/ui/cn'

/**
 * CoreSight IQ mark + wordmark. The mark is a rounded ink tile with a
 * sight-line cross and a teal core; the wordmark pairs the display face with a
 * small "IQ" chip.
 */
export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden className="shrink-0">
        <rect width="22" height="22" rx="6" fill="#131722" />
        <path d="M11 3.5v4.6M11 13.9v4.6M3.5 11h4.6M13.9 11h4.6" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.85" />
        <circle cx="11" cy="11" r="2.6" fill="#2dd4bf" />
        <circle cx="11" cy="11" r="1.1" fill="#131722" />
      </svg>
      {showWord && (
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-[16px] font-semibold leading-none tracking-[-0.01em] text-fg">
            CoreSight
          </span>
          <span className="rounded-[4px] bg-fg px-1 py-[2px] font-mono text-[8.5px] font-semibold leading-none tracking-[0.08em] text-white">
            IQ
          </span>
        </span>
      )}
    </span>
  )
}
