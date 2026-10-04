/**
 * POST /api/data/files/[id]/import
 * Body: { kind: string, mapping?: { field: column }, dryRun?: boolean }
 *  dryRun → 200 validation preview (mapping, skipped rows with reasons,
 *           duplicates in-file and already imported, rows that would insert)
 *  commit → 201 { import } — one atomic transaction; 409 if this exact content
 *           was already imported as this kind; 413 over a workspace limit.
 */
import { NextResponse } from 'next/server'
import { commitImport, previewImport } from '@/server/imports'
import { badRequest, requireWorkspace, isUuid, notFound, serviceError, refreshWorkspace } from '../../../_lib'

export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const { id } = await params
  if (!isUuid(id)) return notFound()
  const body = (await req.json().catch(() => null)) as { kind?: unknown; mapping?: unknown; dryRun?: unknown } | null
  if (!body || typeof body.kind !== 'string') return badRequest('Expected JSON body with "kind".')

  try {
    if (body.dryRun === true) return NextResponse.json({ preview: await previewImport(ws, id, body.kind, body.mapping) })
    const result = await commitImport(ws, id, body.kind, body.mapping)
    refreshWorkspace(ws)
    return NextResponse.json({ import: result }, { status: 201 })
  } catch (e) {
    return serviceError(e)
  }
}
