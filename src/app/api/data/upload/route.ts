/**
 * POST /api/data/upload — multipart upload into the caller's private workspace.
 * Fields: file (one per request; the client uploads sequentially for per-file
 * progress), scope (optional, default "shared"). Validates format, size and
 * quotas, parses tabular formats, and stores raw bytes + a content hash.
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { validateUpload, detectFormat, parseBuffer, quotaError, MAX_NAME_LENGTH } from '@/core/workspace'
import { GLOBAL_FILE_BYTES_CAP } from '@/core/imports/limits'
import { sha256Hex } from '@/core/imports/keys'
import { toDto, badRequest, isScope, dbUnavailable, workspaceUsage, requireWorkspace } from '../_lib'

export const maxDuration = 30

export async function POST(req: Request) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Expected multipart/form-data with a "file" field.')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return badRequest('Missing "file" field.')
  const scopeRaw = form.get('scope') ?? 'shared'
  if (!isScope(scopeRaw)) return badRequest('Invalid scope.')

  const invalid = validateUpload(file.name, file.size)
  if (invalid) return badRequest(invalid)
  const format = detectFormat(file.name)!

  const bytes = new Uint8Array(await file.arrayBuffer())
  const parsed = parseBuffer(format, bytes)

  try {
    const db = getDb()
    const usage = await workspaceUsage(db, ws)
    const overQuota = quotaError(usage, file.size, { bytes: usage.globalBytes, cap: GLOBAL_FILE_BYTES_CAP })
    if (overQuota) return NextResponse.json({ error: overQuota }, { status: 413 })

    const [row] = await db
      .insert(workspaceFiles)
      .values({
        workspaceId: ws,
        name: file.name.replace(/\.[^.]+$/, '').slice(0, MAX_NAME_LENGTH) || 'untitled',
        originalFilename: file.name.slice(0, 255),
        format,
        sizeBytes: file.size,
        scope: scopeRaw,
        status: parsed.error ? 'error' : 'ready',
        error: parsed.error ?? null,
        columns: parsed.table?.columns ?? null,
        rowCount: parsed.table?.rowCount ?? null,
        sampleRows: parsed.table?.sampleRows ?? null,
        textPreview: parsed.textPreview ?? null,
        rawBase64: Buffer.from(bytes).toString('base64'),
        contentHash: sha256Hex(bytes),
      })
      .returning()
    return NextResponse.json({ file: toDto(row) }, { status: 201 })
  } catch (e) {
    return dbUnavailable(e)
  }
}
