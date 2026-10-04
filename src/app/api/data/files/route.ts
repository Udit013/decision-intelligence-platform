/** GET /api/data/files[?scope=…] — the caller's workspace files, newest first. */
import { NextResponse } from 'next/server'
import { and, desc, eq, or } from 'drizzle-orm'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { toDto, isScope, dbUnavailable, requireWorkspace } from '../_lib'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const scope = new URL(req.url).searchParams.get('scope')
  try {
    const where = isScope(scope)
      ? and(eq(workspaceFiles.workspaceId, ws), or(eq(workspaceFiles.scope, scope), eq(workspaceFiles.scope, 'shared')))
      : eq(workspaceFiles.workspaceId, ws)
    const rows = await getDb().select().from(workspaceFiles).where(where).orderBy(desc(workspaceFiles.createdAt))
    return NextResponse.json({ files: rows.map(toDto) })
  } catch (e) {
    return dbUnavailable(e)
  }
}
