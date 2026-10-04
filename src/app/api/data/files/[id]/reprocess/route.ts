/**
 * POST /api/data/files/[id]/reprocess — re-parse the stored bytes.
 * With multipart form ("file") it acts as REPLACE: new bytes, same entry.
 * Imports are tracked separately (by content hash), so replacing a file never
 * alters data already imported from it.
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { parseBuffer, validateUpload, detectFormat, quotaError, type FileFormat } from '@/core/workspace'
import { GLOBAL_FILE_BYTES_CAP } from '@/core/imports/limits'
import { sha256Hex } from '@/core/imports/keys'
import { toDto, badRequest, dbUnavailable, workspaceUsage, requireWorkspace, isUuid, notFound, ownFile } from '../../../_lib'

export const maxDuration = 30

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const { id } = await params
  if (!isUuid(id)) return notFound()

  try {
    const db = getDb()
    const [existing] = await db.select().from(workspaceFiles).where(ownFile(ws, id))
    if (!existing) return notFound()

    let format = existing.format as FileFormat
    let bytes: Uint8Array
    let sizeBytes = existing.sizeBytes
    let originalFilename = existing.originalFilename

    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const file = (await req.formData()).get('file')
      if (!(file instanceof File)) return badRequest('Missing "file" field for replace.')
      const invalid = validateUpload(file.name, file.size)
      if (invalid) return badRequest(invalid)
      const usage = await workspaceUsage(db, ws)
      // Replacing keeps the file count; only the byte delta counts against quotas.
      const overQuota = quotaError(
        { files: 0, bytes: usage.bytes - existing.sizeBytes },
        file.size,
        { bytes: usage.globalBytes - existing.sizeBytes, cap: GLOBAL_FILE_BYTES_CAP },
      )
      if (overQuota) return NextResponse.json({ error: overQuota }, { status: 413 })
      format = detectFormat(file.name)!
      bytes = new Uint8Array(await file.arrayBuffer())
      sizeBytes = file.size
      originalFilename = file.name.slice(0, 255)
    } else {
      bytes = new Uint8Array(Buffer.from(existing.rawBase64, 'base64'))
    }

    const parsed = parseBuffer(format, bytes)
    const [row] = await db
      .update(workspaceFiles)
      .set({
        format,
        sizeBytes,
        originalFilename,
        status: parsed.error ? 'error' : 'ready',
        error: parsed.error ?? null,
        columns: parsed.table?.columns ?? null,
        rowCount: parsed.table?.rowCount ?? null,
        sampleRows: parsed.table?.sampleRows ?? null,
        textPreview: parsed.textPreview ?? null,
        rawBase64: Buffer.from(bytes).toString('base64'),
        contentHash: sha256Hex(bytes),
        updatedAt: new Date(),
      })
      .where(ownFile(ws, id))
      .returning()
    return NextResponse.json({ file: toDto(row) })
  } catch (e) {
    return dbUnavailable(e)
  }
}
