/**
 * Dataset statusline — a full-width mono strip under the masthead (terminal
 * convention): what data powers this module right now, and how many workspace
 * uploads are available to it. Server component with one light query; wrapped
 * in Suspense by the layout and fails soft (built-in label only) without a DB.
 */
import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import type { DomainId } from '@/core/registry'

const BUILT_IN: Record<DomainId, string> = {
  operations: 'UCI Online Retail II · real',
  market: 'Synthetic markets · demo',
  product: 'Synthetic users · demo',
}

async function fetchStatus(domain: DomainId) {
  try {
    const db = getDb()
    const res: unknown = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM workspace_files WHERE scope = 'shared' OR scope = ${domain})::int AS available,
        (SELECT COUNT(*) FROM workspace_files WHERE ingested_at IS NOT NULL)::int AS ingested
    `)
    const row = (
      Array.isArray(res) ? res[0] : (res as { rows?: Record<string, unknown>[] }).rows?.[0]
    ) as Record<string, unknown> | undefined
    return { available: Number(row?.available ?? 0), ingested: Number(row?.ingested ?? 0) }
  } catch {
    return null
  }
}

export async function DatasetStatus({ domain }: { domain: DomainId }) {
  const status = await fetchStatus(domain)
  const ingested = domain === 'operations' && status?.ingested ? ` +${status.ingested} ingested` : ''

  return (
    <div className="border-b border-border/70 bg-surface-2/40">
      <div className="mx-auto flex max-w-7xl items-center gap-x-2 overflow-x-auto px-4 py-[7px] font-mono text-[10px] uppercase tracking-[0.1em] sm:px-6">
        <span className="mr-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
        <span className="shrink-0 text-muted">dataset</span>
        <span className="shrink-0 font-medium text-fg">{BUILT_IN[domain]}{ingested}</span>
        {status && status.available > 0 && (
          <span className="shrink-0 text-muted">
            · {status.available} workspace file{status.available > 1 ? 's' : ''}
          </span>
        )}
        <Link href="/data" className="ml-auto shrink-0 font-medium text-[var(--accent)] underline-offset-2 hover:underline">
          manage →
        </Link>
      </div>
    </div>
  )
}
