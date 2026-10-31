/**
 * Workspace activity tracking and expiry.
 *
 * Every visitor workspace has one row in workspace_activity, refreshed (at most
 * hourly) when the workspace is used. A workspace expires only when that row
 * exists and is older than the threshold — never on inference. The demo
 * workspace has no row and can never expire; data in a workspace without an
 * activity row is reported, not deleted.
 */
import { sql } from 'drizzle-orm'
import { atomic, getDb } from '@/db'
import { DEMO_WORKSPACE_ID } from '@/db/ids'

export const EXPIRY_DAYS = 90
/** Refuse to run with a threshold small enough to wipe active users after a typo. */
export const MIN_EXPIRY_DAYS = 30
const DEFAULT_BATCH = 25

type Rows<T> = { rows: T[] }
const rowsOf = <T>(r: unknown) => (r as Rows<T>).rows

export async function touchWorkspace(workspaceId: string): Promise<void> {
  if (workspaceId === DEMO_WORKSPACE_ID) return
  try {
    await getDb().execute(sql`
      INSERT INTO workspace_activity (workspace_id) VALUES (${workspaceId})
      ON CONFLICT (workspace_id) DO UPDATE SET last_active_at = now()
      WHERE workspace_activity.last_active_at < now() - interval '1 hour'`)
  } catch (e) {
    console.warn('[activity] touch failed:', (e as Error).message)
  }
}

function assertDays(days: number) {
  if (!Number.isInteger(days) || days < MIN_EXPIRY_DAYS) throw new Error(`Expiry threshold must be a whole number of days ≥ ${MIN_EXPIRY_DAYS}.`)
}

export interface ExpiryCandidate {
  workspaceId: string
  lastActiveAt: string
  files: number
  imports: number
}

export async function findExpired(days = EXPIRY_DAYS, limit = DEFAULT_BATCH): Promise<ExpiryCandidate[]> {
  assertDays(days)
  const db = getDb()
  const stale = rowsOf<{ workspace_id: string; last_active_at: string }>(
    await db.execute(sql`
      SELECT workspace_id, last_active_at FROM workspace_activity
      WHERE last_active_at < now() - make_interval(days => ${days}) AND workspace_id <> ${DEMO_WORKSPACE_ID}
      ORDER BY last_active_at LIMIT ${limit}`),
  )
  const out: ExpiryCandidate[] = []
  for (const s of stale) {
    const c = rowsOf<{ files: number; imports: number }>(
      await db.execute(sql`SELECT (SELECT count(*) FROM workspace_files WHERE workspace_id = ${s.workspace_id})::int AS files,
                                  (SELECT count(*) FROM data_imports WHERE workspace_id = ${s.workspace_id})::int AS imports`),
    )[0]
    out.push({ workspaceId: s.workspace_id, lastActiveAt: new Date(s.last_active_at).toISOString(), files: Number(c.files), imports: Number(c.imports) })
  }
  return out
}

const FACT_TABLES = [
  'operations_invoice_lines', 'operations_invoices', 'operations_customers', 'operations_products',
  'market_indicators', 'market_competitors', 'product_tracked_events', 'product_experiment_stats', 'product_backlog_items',
  'data_imports', 'workspace_files',
] as const

/**
 * Deletes one workspace in a single transaction. EVERY statement re-checks that
 * the activity row still exists and is still older than the threshold, so a
 * workspace that became active after selection is left intact.
 */
export async function deleteIfStale(workspaceId: string, days = EXPIRY_DAYS): Promise<void> {
  assertDays(days)
  if (workspaceId === DEMO_WORKSPACE_ID) throw new Error('The demo workspace never expires.')
  const stale = sql`EXISTS (SELECT 1 FROM workspace_activity a WHERE a.workspace_id = ${workspaceId} AND a.last_active_at < now() - make_interval(days => ${days}))`
  await atomic((q) => [
    ...FACT_TABLES.map((t) => q.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE workspace_id = ${workspaceId} AND ${stale}`)),
    q.execute(sql`DELETE FROM workspace_activity WHERE workspace_id = ${workspaceId} AND last_active_at < now() - make_interval(days => ${days})`),
  ])
}

export interface ExpiryReport {
  dryRun: boolean
  days: number
  candidates: ExpiryCandidate[]
  expired: number
  rateLimitRowsRemoved: number
  /** Workspaces holding data but with no activity record: reported, never deleted. */
  untrackedWorkspaces: number
}

export async function expireWorkspaces(opts: { days?: number; limit?: number; dryRun?: boolean } = {}): Promise<ExpiryReport> {
  const days = opts.days ?? EXPIRY_DAYS
  const dryRun = opts.dryRun ?? true
  assertDays(days)
  const db = getDb()
  const candidates = await findExpired(days, opts.limit ?? DEFAULT_BATCH)

  let expired = 0
  let rateLimitRowsRemoved = 0
  if (!dryRun) {
    for (const c of candidates) {
      await deleteIfStale(c.workspaceId, days)
      expired++
    }
    const r = rowsOf<{ n: number }>(await db.execute(sql`WITH d AS (DELETE FROM rate_limits WHERE expires_at < now() RETURNING 1) SELECT count(*)::int AS n FROM d`))
    rateLimitRowsRemoved = Number(r[0]?.n ?? 0)
  }

  const untracked = rowsOf<{ n: number }>(
    await db.execute(sql`
      SELECT count(*)::int AS n FROM (
        SELECT workspace_id FROM workspace_files UNION SELECT workspace_id FROM data_imports
      ) w WHERE workspace_id <> ${DEMO_WORKSPACE_ID}
        AND NOT EXISTS (SELECT 1 FROM workspace_activity a WHERE a.workspace_id = w.workspace_id)`),
  )
  return { dryRun, days, candidates, expired, rateLimitRowsRemoved, untrackedWorkspaces: Number(untracked[0]?.n ?? 0) }
}
