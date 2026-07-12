import type { Recommendation } from '@/core/recommend'

/** Inline confidence meter — five mono blocks, filled to the score. */
function ConfidenceMeter({ value }: { value: number }) {
  const filled = Math.round(value * 5)
  return (
    <span className="font-mono text-[11px] tabular-nums text-[var(--accent)]" title={`${Math.round(value * 100)}% confidence`}>
      {'▮'.repeat(filled)}
      <span className="text-border">{'▮'.repeat(5 - filled)}</span>
      <span className="ml-1.5 text-muted">{Math.round(value * 100)}%</span>
    </span>
  )
}

/**
 * Decision docket — ranked recommendations set as ruled ledger entries: a serif
 * rank numeral, the case, the expected result, and an inline confidence meter.
 * Replaces the interchangeable "stack of rounded cards" pattern.
 */
export function Docket({ decisions }: { decisions: Recommendation[] }) {
  return (
    <ol>
      {decisions.map((d) => (
        <li key={d.id} className="grid grid-cols-[2.6rem_1fr] gap-x-3 border-b border-border py-4 last:border-b-0">
          <span className="font-display text-[26px] font-medium leading-none text-muted/60">
            {String(d.priority).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-display text-[17px] font-medium leading-tight">{d.title}</p>
              <ConfidenceMeter value={d.confidence} />
            </div>
            <p className="kicker mt-1">{d.category}</p>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-fg">{d.recommendation}</p>
            <p className="mt-1.5 text-[13px] font-medium text-[var(--accent)]">→ {d.expectedResult}</p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">{d.reasoning}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
