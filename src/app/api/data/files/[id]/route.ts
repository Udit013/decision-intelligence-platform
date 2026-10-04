/**
 * /api/data/files/[id] — scoped to the caller's workspace (another workspace's
 * file id is indistinguishable from a missing one).
 *  GET    — file detail (metadata + preview; never the raw payload)
 *  PATCH  — rename ({ name }) and/or re-scope ({ scope })
 *  DELETE — remove the file (data already imported from it stays; undo the import to remove it)
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { MAX_NAME_LENGTH } from '@/core/workspace'
import { toDto, badRequest, isScope, dbUnavailable, requireWorkspace, isUuid, notFound, ownFile } from '../../_lib'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const { id } = await params
  if (!isUuid(id)) return notFound()
  try {
    const [row] = await getDb().select().from(workspaceFiles).where(ownFile(ws, id))
    return row ? NextResponse.json({ file: toDto(row) }) : notFound()
  } catch (e) {
    return dbUnavailable(e)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const { id } = await params
  if (!isUuid(id)) return notFound()
  const body = (await req.json().catch(() => null)) as { name?: unknown; scope?: unknown } | null
  if (!body) return badRequest('Expected JSON body.')

  const updates: Partial<{ name: string; scope: string; updatedAt: Date }> = {}
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > MAX_NAME_LENGTH) return badRequest(`Name must be 1–${MAX_NAME_LENGTH} characters.`)
    updates.name = name
  }
  if (body.scope !== undefined) {
    if (!isScope(body.scope)) return badRequest('Invalid scope.')
    updates.scope = body.scope
  }
  if (!Object.keys(updates).length) return badRequest('Nothing to update (send name and/or scope).')
  updates.updatedAt = new Date()

  try {
    const [row] = await getDb().update(workspaceFiles).set(updates).where(ownFile(ws, id)).returning()
    return row ? NextResponse.json({ file: toDto(row) }) : notFound()
  } catch (e) {
    return dbUnavailable(e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const { id } = await params
  if (!isUuid(id)) return notFound()
  try {
    const [row] = await getDb().delete(workspaceFiles).where(ownFile(ws, id)).returning({ id: workspaceFiles.id })
    return row ? NextResponse.json({ deleted: row.id }) : notFound()
  } catch (e) {
    return dbUnavailable(e)
  }
}
