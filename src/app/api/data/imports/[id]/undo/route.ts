/** POST /api/data/imports/[id]/undo — removes exactly the rows that import added. */
import { NextResponse } from 'next/server'
import { undoImport } from '@/server/imports'
import { requireWorkspace, isUuid, notFound, serviceError, refreshWorkspace } from '../../../_lib'

export const maxDuration = 60

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  const { id } = await params
  if (!isUuid(id)) return notFound('Import')
  try {
    const result = await undoImport(ws, id)
    refreshWorkspace(ws)
    return NextResponse.json({ undone: result })
  } catch (e) {
    return serviceError(e)
  }
}
