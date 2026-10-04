/**
 * Dataset statusline — a full-width mono strip under the masthead: which data
 * this module is showing right now (the sample, or the visitor's own imports)
 * and a switch between them. Streams in under Suspense; fails soft to the
 * sample when the database is unreachable.
 */
import Link from 'next/link'
import type { DomainId } from '@/core/registry'
import { resolveDataSource } from '@/server/workspace'
import { cn } from '@/ui/cn'
import { ModeButton } from './ModeButton'

const SAMPLE: Record<DomainId, string> = {
  operations: 'UCI Online Retail II · real sample',
  market: '120 synthetic markets · sample',
  product: '3,000 synthetic users · sample',
}

export async function DatasetStatus({ domain }: { domain: DomainId }) {
  const src = await resolveDataSource(domain)
  const label =
    src.kind === 'workspace' ? 'Your data' : src.kind === 'empty' ? 'Your data · nothing imported yet' : SAMPLE[domain]
  const seg = 'rounded-[5px] px-2 py-[3px] transition-colors'

  return (
    <div className="border-b border-border/70 bg-surface-2/40">
      <div className="mx-auto flex max-w-7xl items-center gap-x-2 overflow-x-auto px-4 py-[5px] font-mono text-[10px] uppercase tracking-[0.1em] sm:px-6">
        <span
          className={cn('mr-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full', src.kind === 'demo' ? 'bg-warn' : 'bg-[var(--accent)]')}
          aria-hidden
        />
        <span className="shrink-0 text-muted">dataset</span>
        <span className="shrink-0 font-medium text-fg" aria-live="polite">{label}</span>
        {src.degraded && <span className="shrink-0 text-warn">· database unreachable, showing sample</span>}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex items-center rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Data shown">
            <ModeButton
              domain={domain}
              mode="demo"
              className={cn(seg, src.kind === 'demo' ? 'bg-fg text-bg' : 'text-muted hover:text-fg')}
            >
              Sample
            </ModeButton>
            <ModeButton
              domain={domain}
              mode="yours"
              className={cn(seg, src.kind !== 'demo' ? 'bg-fg text-bg' : 'text-muted hover:text-fg')}
            >
              Your data
            </ModeButton>
          </div>
          <Link href="/data" className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
            manage →
          </Link>
        </div>
      </div>
    </div>
  )
}
