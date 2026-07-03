/**
 * /api/data/files/[id]
 *  GET    — file detail (metadata + preview; never the raw payload)
 *  PATCH  — rename ({ name }) and/or re-scope ({ scope })
 *  DELETE — remove the file
 */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { toDto, badRequest, isScope, dbUnavailable } from '../../_lib'

type Ctx = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ error: 'File not found.' }, { status: 404 })
const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID_RE.test(id)) return notFound()
  try {
    const [row] = await getDb().select().from(workspaceFiles).where(eq(workspaceFiles.id, id))
    return row ? NextResponse.json({ file: toDto(row) }) : notFound()
  } catch (e) {
    return dbUnavailable(e)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID_RE.test(id)) return notFound()
  const body = (await req.json().catch(() => null)) as { name?: unknown; scope?: unknown } | null
  if (!body) return badRequest('Expected JSON body.')

  const updates: Partial<{ name: string; scope: string; updatedAt: Date }> = {}
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 200) return badRequest('Name must be 1–200 characters.')
    updates.name = name
  }
  if (body.scope !== undefined) {
    if (!isScope(body.scope)) return badRequest('Invalid scope.')
    updates.scope = body.scope
  }
  if (!Object.keys(updates).length) return badRequest('Nothing to update (send name and/or scope).')
  updates.updatedAt = new Date()

  try {
    const [row] = await getDb().update(workspaceFiles).set(updates).where(eq(workspaceFiles.id, id)).returning()
    return row ? NextResponse.json({ file: toDto(row) }) : notFound()
  } catch (e) {
    return dbUnavailable(e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!UUID_RE.test(id)) return notFound()
  try {
    const [row] = await getDb().delete(workspaceFiles).where(eq(workspaceFiles.id, id)).returning({ id: workspaceFiles.id })
    return row ? NextResponse.json({ deleted: row.id }) : notFound()
  } catch (e) {
    return dbUnavailable(e)
  }
}
