/** Shared helpers for the Data Workspace API routes. */
import { NextResponse } from 'next/server'
import type { workspaceFiles } from '@/db/schema'
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

/** Uniform 503 when DATABASE_URL is missing/unreachable. */
export function dbUnavailable(e: unknown) {
  return NextResponse.json(
    { error: `Data workspace needs a database: ${(e as Error).message}` },
    { status: 503 },
  )
}
