/**
 * Fixed-window rate limiting backed by one Postgres upsert per request.
 *
 * Two subjects are counted together: the visitor's workspace and their network
 * address (hashed, never stored raw) — the latter stops someone from dodging a
 * per-workspace limit by discarding their cookie. If the database is
 * unreachable the limiter fails OPEN, so the database-free demo keeps working;
 * abuse protection then falls back to the capacity caps.
 */
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'

export interface LimitRule {
  /** Max requests per window for one workspace. */
  limit: number
  windowSec: number
  /** Multiplier for the per-address limit (shared networks need headroom). */
  ipFactor?: number
}

export const LIMITS = {
  upload: { limit: 20, windowSec: 600, ipFactor: 3 },
  previewImport: { limit: 120, windowSec: 600, ipFactor: 3 },
  commitImport: { limit: 15, windowSec: 600, ipFactor: 3 },
  undoImport: { limit: 30, windowSec: 600, ipFactor: 3 },
  eraseWorkspace: { limit: 5, windowSec: 3600, ipFactor: 2 },
  claimWorkspace: { limit: 20, windowSec: 600, ipFactor: 1 },
  advisor: { limit: 30, windowSec: 60, ipFactor: 1 },
} as const satisfies Record<string, LimitRule>

export type LimitAction = keyof typeof LIMITS

export function windowIndex(nowMs: number, windowSec: number) {
  return Math.floor(nowMs / (windowSec * 1000))
}

/** Best-effort client address. On Vercel x-forwarded-for / x-real-ip are set by the platform. */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

const digest = (v: string) => createHash('sha256').update(v).digest('hex').slice(0, 24)

export interface Decision {
  ok: boolean
  retryAfterSec: number
}

/** Count one hit against each subject; allowed only if every subject is within its limit. */
export async function consume(
  action: LimitAction,
  subjects: { workspaceId?: string | null; ip: string },
  nowMs = Date.now(),
): Promise<Decision> {
  const rule: LimitRule = LIMITS[action]
  const win = windowIndex(nowMs, rule.windowSec)
  const expires = new Date((win + 2) * rule.windowSec * 1000)
  const entries: { bucket: string; max: number }[] = [
    { bucket: `ip:${action}:${digest(subjects.ip)}:${win}`, max: rule.limit * (rule.ipFactor ?? 1) },
  ]
  if (subjects.workspaceId) entries.push({ bucket: `ws:${action}:${subjects.workspaceId}:${win}`, max: rule.limit })

  const values = sql.join(entries.map((e) => sql`(${e.bucket}, 1, ${expires.toISOString()}::timestamptz)`), sql`, `)
  const res = await getDb().execute(sql`
    INSERT INTO rate_limits (bucket, hits, expires_at) VALUES ${values}
    ON CONFLICT (bucket) DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING bucket, hits`)
  const rows = (res as unknown as { rows: { bucket: string; hits: number }[] }).rows
  const max = new Map(entries.map((e) => [e.bucket, e.max]))
  const over = rows.some((r) => Number(r.hits) > (max.get(r.bucket) ?? Infinity))
  return { ok: !over, retryAfterSec: over ? Math.max(1, Math.ceil(((win + 1) * rule.windowSec * 1000 - nowMs) / 1000)) : 0 }
}

/** Route helper: returns a 429 response when over the limit, otherwise null. */
export async function enforce(req: Request, action: LimitAction, workspaceId?: string | null): Promise<NextResponse | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const d = await consume(action, { workspaceId, ip: clientIp(req.headers) })
    if (d.ok) return null
    return NextResponse.json(
      { error: `Too many requests — please wait ${d.retryAfterSec} second${d.retryAfterSec === 1 ? '' : 's'} and try again.` },
      { status: 429, headers: { 'Retry-After': String(d.retryAfterSec) } },
    )
  } catch (e) {
    console.warn('[rate-limit] failing open:', (e as Error).message)
    return null
  }
}
