/** GET /api/data/files — list workspace files (newest first), optional ?scope= filter. */
import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { workspaceFiles } from '@/db/schema'
import { toDto, isScope, dbUnavailable } from '../_lib'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get('scope')
  try {
    const db = getDb()
    const rows = await (isScope(scope)
      ? db.select().from(workspaceFiles).where(eq(workspaceFiles.scope, scope)).orderBy(desc(workspaceFiles.createdAt))
      : db.select().from(workspaceFiles).orderBy(desc(workspaceFiles.createdAt)))
    return NextResponse.json({ files: rows.map(toDto) })
  } catch (e) {
    return dbUnavailable(e)
  }
}
