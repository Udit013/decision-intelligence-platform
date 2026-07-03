/**
 * Active-dataset strip shown in every module: what data is powering the module
 * right now, plus how many workspace uploads are available to it. Server
 * component with one light query; wrapped in Suspense by the layout and fails
 * soft (built-in label only) when the DB is unreachable.
 */
import Link from 'next/link'
import { Database } from 'lucide-react'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import type { DomainId } from '@/core/registry'

const BUILT_IN: Record<DomainId, string> = {
  operations: 'UCI Online Retail II (real)',
  market: 'Built-in synthetic markets (demo)',
  product: 'Built-in synthetic users (demo)',
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
  const ingestedNote = domain === 'operations' && status?.ingested ? ` + ${status.ingested} ingested upload${status.ingested > 1 ? 's' : ''}` : ''

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Database className="h-3.5 w-3.5 text-[var(--accent)]" />
        Active dataset:
      </span>
      <span className="font-medium">{BUILT_IN[domain]}{ingestedNote}</span>
      {status && status.available > 0 && (
        <span className="text-muted">· {status.available} workspace file{status.available > 1 ? 's' : ''} available</span>
      )}
      <Link href="/data" className="ml-auto font-medium text-[var(--accent)] hover:underline">
        Manage data →
      </Link>
    </div>
  )
}
