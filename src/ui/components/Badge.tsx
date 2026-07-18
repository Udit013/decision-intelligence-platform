import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/ui/cn'
import type { DataProvenance } from '@/core/registry'

/**
 * Status tag — a colored dot beside quiet small-caps text. No tinted pill
 * backgrounds; the dot carries the state, the text stays legible.
 */
const badge = cva(
  'inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.12em]',
  {
    variants: {
      tone: {
        neutral: 'text-muted',
        good: 'text-fg/75',
        warn: 'text-fg/75',
        bad: 'text-fg/75',
        accent: 'text-fg/75',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const dot = cva('h-[6px] w-[6px] shrink-0 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted/50',
      good: 'bg-good',
      warn: 'bg-warn',
      bad: 'bg-bad',
      accent: 'bg-[var(--accent)]',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({
  className,
  tone,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      <span className={dot({ tone })} aria-hidden />
      {children}
    </span>
  )
}

/** Honest data-provenance tag: real datasets vs labeled demo data. */
export function ProvenanceBadge({ provenance, source }: { provenance: DataProvenance; source: string }) {
  return (
    <Badge tone={provenance === 'real' ? 'good' : 'warn'} title={source}>
      {provenance === 'real' ? 'Real data' : 'Demo data'}
    </Badge>
  )
}
