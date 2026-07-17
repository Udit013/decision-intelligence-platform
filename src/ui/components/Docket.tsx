import type { Recommendation } from '@/core/recommend'

/** Inline confidence meter — a slim bar filled to the score. */
function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <span className="inline-flex items-center gap-2" title={`${pct}% confidence`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span
          className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted">{pct}%</span>
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
        <li key={d.id} className="grid grid-cols-[2.6rem_1fr] gap-x-3 border-b border-border/70 py-4 transition-colors last:border-b-0 hover:bg-surface-2/30">
          <span className="font-display text-[24px] font-semibold leading-none tracking-tight text-muted/50">
            {String(d.priority).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="font-display text-[16px] font-semibold leading-tight tracking-[-0.01em]">{d.title}</p>
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
