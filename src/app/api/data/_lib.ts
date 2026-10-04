/** Shared helpers for the Data Workspace API routes. */
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import type { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { SCOPES, type FileScope } from '@/core/workspace'

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
    ingestedAt: f.ingestedAt,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }
}

export type WorkspaceFileDto = ReturnType<typeof toDto>

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function isScope(v: unknown): v is FileScope {
  return typeof v === 'string' && (SCOPES as string[]).includes(v)
}

/** Uniform 503 for storage failures. Details stay in server logs, never the response. */
export function dbUnavailable(e: unknown) {
  console.error('[data-workspace]', e)
  return NextResponse.json(
    { error: 'The data workspace is temporarily unavailable. Please try again shortly.' },
    { status: 503 },
  )
}

/** Current workspace footprint, for quota checks. */
export async function workspaceUsage(db: ReturnType<typeof getDb>) {
  const [u] = await db
    .select({
      files: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${workspaceFiles.sizeBytes}), 0)::bigint`,
    })
    .from(workspaceFiles)
  return { files: Number(u.files), bytes: Number(u.bytes) }
}
