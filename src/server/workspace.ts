import 'server-only'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { dataImports } from '@/db/schema'
import { DEMO_WORKSPACE_ID } from '@/db/ids'
import {
  WORKSPACE_COOKIE,
  MODE_COOKIE,
  isWorkspaceToken,
  parseModes,
  resolveSource,
  type DomainKey,
  type DataMode,
} from '@/core/tenancy'

/** sha256(token) shaped as a v4 UUID. The raw token never reaches the database. */
export function workspaceIdFromToken(token: string): string {
  const h = createHash('sha256').update(token).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** The visitor's private workspace id, or null when no valid cookie exists. */
export async function currentWorkspaceId(): Promise<string | null> {
  const token = (await cookies()).get(WORKSPACE_COOKIE)?.value
  return isWorkspaceToken(token) ? workspaceIdFromToken(token) : null
}

export async function currentModes(): Promise<Partial<Record<DomainKey, DataMode>>> {
  return parseModes((await cookies()).get(MODE_COOKIE)?.value)
}

/** Count of live imports per domain for a workspace (cheap: indexed, tiny table). */
export async function liveImportCounts(workspaceId: string): Promise<Record<DomainKey, number>> {
  const counts: Record<DomainKey, number> = { operations: 0, market: 0, product: 0 }
  const rows = await getDb()
    .select({ domain: dataImports.domain, n: sql<number>`count(*)::int` })
    .from(dataImports)
    .where(and(eq(dataImports.workspaceId, workspaceId), eq(dataImports.status, 'committed')))
    .groupBy(dataImports.domain)
  for (const r of rows) counts[r.domain as DomainKey] = Number(r.n)
  return counts
}

export interface DataSource {
  domain: DomainKey
  /** workspace = the visitor's own data · demo = sample data · empty = asked for own data, has none */
  kind: 'workspace' | 'demo' | 'empty'
  mode: DataMode
  /** Workspace whose rows to read (the demo workspace for demo Operations). */
  workspaceId: string
  hasOwnData: boolean
  /** True when the database could not be reached; the module falls back to demo. */
  degraded: boolean
}

/** Resolves which dataset a module renders for the current visitor. */
export async function resolveDataSource(domain: DomainKey): Promise<DataSource> {
  const [wsId, modes] = await Promise.all([currentWorkspaceId(), currentModes()])
  const mode = modes[domain] ?? 'auto'
  let hasOwnData = false
  let degraded = false
  if (wsId && process.env.DATABASE_URL) {
    try {
      hasOwnData = (await liveImportCounts(wsId))[domain] > 0
    } catch {
      degraded = true
    }
  }
  const kind = resolveSource(mode, hasOwnData)
  return {
    domain,
    kind,
    mode,
    workspaceId: kind === 'workspace' && wsId ? wsId : DEMO_WORKSPACE_ID,
    hasOwnData,
    degraded,
  }
}
