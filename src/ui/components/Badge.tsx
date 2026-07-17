import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/ui/cn'
import type { DataProvenance } from '@/core/registry'

/** Status badge — softly tinted pill; color always communicates state. */
const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-[3px] font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em]',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-muted',
        good: 'bg-good/10 text-good',
        warn: 'bg-warn/10 text-warn',
        bad: 'bg-bad/10 text-bad',
        accent: 'bg-[var(--accent)]/10 text-[var(--accent)]',
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
