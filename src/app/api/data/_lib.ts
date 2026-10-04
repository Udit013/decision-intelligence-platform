/** Shared helpers for the Data Workspace API routes. */
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { DEMO_WORKSPACE_ID } from '@/db/ids'
import { SCOPES, type FileScope } from '@/core/workspace'
import { currentWorkspaceId } from '@/server/workspace'
import { ImportError } from '@/server/imports'

export type WorkspaceFileRow = typeof workspaceFiles.$inferSelect

/** Public JSON shape — never includes the raw payload. */
export function toDto(f: WorkspaceFileRow) {
  return {
    id: f.id,
    name: f.name,
    originalFilename: f.originalFilename,
    format: f.format,
    sizeBytes: f.sizeBytes,
    scope: f.scope,
    status: f.status,
    error: f.error,
    columns: f.columns,
    rowCount: f.rowCount,
    sampleRows: f.sampleRows,
    textPreview: f.textPreview,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }
}

export type WorkspaceFileDto = ReturnType<typeof toDto>

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(what = 'File') {
  return NextResponse.json({ error: `${what} not found.` }, { status: 404 })
}

export function isScope(v: unknown): v is FileScope {
  return typeof v === 'string' && (SCOPES as string[]).includes(v)
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** The caller's workspace id, or a 401 response when the browser sent no workspace cookie. */
export async function requireWorkspace(): Promise<string | NextResponse> {
  const id = await currentWorkspaceId()
  if (!id || id === DEMO_WORKSPACE_ID) {
    return NextResponse.json({ error: 'Your private workspace needs cookies. Enable cookies for this site and reload.' }, { status: 401 })
  }
  return id
}

/** Uniform 503 for storage failures. Details stay in server logs, never the response. */
export function dbUnavailable(e: unknown) {
  console.error('[data-workspace]', e)
  return NextResponse.json(
    { error: 'The data workspace is temporarily unavailable. Please try again shortly.' },
    { status: 503 },
  )
}

/** Maps service errors to their status; anything unexpected becomes a logged 503. */
export function serviceError(e: unknown) {
  if (e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: e.status })
  return dbUnavailable(e)
}

/** Invalidate a workspace's cached analytics so the next request recomputes (never stale). */
export function refreshWorkspace(workspaceId: string) {
  revalidateTag(`ws:${workspaceId}`, { expire: 0 })
}

/** Current workspace footprint and the deployment-wide total, for upload quotas. */
export async function workspaceUsage(db: Db, workspaceId: string) {
  const [u] = await db
    .select({
      files: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${workspaceFiles.sizeBytes}), 0)::bigint`,
    })
    .from(workspaceFiles)
    .where(eq(workspaceFiles.workspaceId, workspaceId))
  const [g] = await db
    .select({ bytes: sql<number>`coalesce(sum(${workspaceFiles.sizeBytes}), 0)::bigint` })
    .from(workspaceFiles)
    .where(ne(workspaceFiles.workspaceId, DEMO_WORKSPACE_ID))
  return { files: Number(u.files), bytes: Number(u.bytes), globalBytes: Number(g.bytes) }
}

export const ownFile = (workspaceId: string, id: string) =>
  and(eq(workspaceFiles.id, id), eq(workspaceFiles.workspaceId, workspaceId))
