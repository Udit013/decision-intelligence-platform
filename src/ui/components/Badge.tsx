import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/ui/cn'
import type { DataProvenance } from '@/core/registry'

const badge = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium font-mono',
  {
    variants: {
      tone: {
        neutral: 'border-border text-muted',
        good: 'border-good/30 bg-good/10 text-good',
        warn: 'border-warn/30 bg-warn/10 text-warn',
        bad: 'border-bad/30 bg-bad/10 text-bad',
        accent: 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]',
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

/** Honest data-provenance badge: real datasets vs labeled demo data. */
export function ProvenanceBadge({ provenance, source }: { provenance: DataProvenance; source: string }) {
  return (
    <Badge tone={provenance === 'real' ? 'good' : 'warn'} title={source}>
      {provenance === 'real' ? 'REAL DATA' : 'DEMO DATA'}
    </Badge>
  )
}
