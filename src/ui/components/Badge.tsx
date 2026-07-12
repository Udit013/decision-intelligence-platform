import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/ui/cn'
import type { DataProvenance } from '@/core/registry'

/** Tag — square, letter-spaced small caps with a hairline. Never a filled pill. */
const badge = cva(
  'inline-flex items-center gap-1 border px-1.5 py-[3px] font-mono text-[10px] font-medium uppercase leading-none tracking-[0.12em]',
  {
    variants: {
      tone: {
        neutral: 'border-border text-muted',
        good: 'border-good/50 text-good',
        warn: 'border-warn/50 text-warn',
        bad: 'border-bad/50 text-bad',
        accent: 'border-[var(--accent)]/50 text-[var(--accent)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}

/** Honest data-provenance tag: real datasets vs labeled demo data. */
export function ProvenanceBadge({ provenance, source }: { provenance: DataProvenance; source: string }) {
  return (
    <Badge tone={provenance === 'real' ? 'good' : 'warn'} title={source}>
      {provenance === 'real' ? 'Real data' : 'Demo data'}
    </Badge>
  )
}
