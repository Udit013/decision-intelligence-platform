/**
 * POST /api/data/files/[id]/reprocess — re-parse the stored raw bytes (e.g. after
 * a parser improvement, or to retry a file that errored).
 *
 * POST with multipart form ("file") acts as REPLACE: overwrites the raw payload
 * with the new file's bytes (same id, name, and scope), then re-parses.
 */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { parseBuffer, validateUpload, detectFormat, type FileFormat } from '@/core/workspace'
import { toDto, badRequest, dbUnavailable } from '../../../_lib'

export const maxDuration = 30

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  try {
    const db = getDb()
    const [existing] = await db.select().from(workspaceFiles).where(eq(workspaceFiles.id, id))
    if (!existing) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

    let format = existing.format as FileFormat
    let bytes: Uint8Array
    let sizeBytes = existing.sizeBytes
    let originalFilename = existing.originalFilename

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      // Replace: new bytes, same workspace entry.
      const file = (await req.formData()).get('file')
      if (!(file instanceof File)) return badRequest('Missing "file" field for replace.')
      const invalid = validateUpload(file.name, file.size)
      if (invalid) return badRequest(invalid)
      format = detectFormat(file.name)!
      bytes = new Uint8Array(await file.arrayBuffer())
      sizeBytes = file.size
      originalFilename = file.name
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
        ingestedAt: null, // new/reparsed content has not been ingested
        updatedAt: new Date(),
      })
      .where(eq(workspaceFiles.id, id))
      .returning()
    return NextResponse.json({ file: toDto(row) })
  } catch (e) {
    return dbUnavailable(e)
  }
}
