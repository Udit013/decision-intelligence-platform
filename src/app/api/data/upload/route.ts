/**
 * POST /api/data/upload — multipart upload into the shared data workspace.
 * Fields: file (one file per request; the client uploads multiple sequentially
 * for per-file progress), scope (optional, default "shared").
 * Validates format + size, parses tabular formats, stores raw + metadata.
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { validateUpload, detectFormat, parseBuffer } from '@/core/workspace'
import { toDto, badRequest, isScope, dbUnavailable } from '../_lib'

export const maxDuration = 30

export async function POST(req: Request) {
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
    const [row] = await db
      .insert(workspaceFiles)
      .values({
        name: file.name.replace(/\.[^.]+$/, ''),
        originalFilename: file.name,
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
      })
      .returning()
    return NextResponse.json({ file: toDto(row) }, { status: 201 })
  } catch (e) {
    return dbUnavailable(e)
  }
}
