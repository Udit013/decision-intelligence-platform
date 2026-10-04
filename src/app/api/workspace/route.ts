/**
 * DELETE /api/workspace — permanently erase every file, import and row in the
 * caller's workspace, then retire its cookie (the next request gets a fresh one).
 */
import { NextResponse } from 'next/server'
import { WORKSPACE_COOKIE } from '@/core/tenancy'
import { deleteWorkspaceData } from '@/server/imports'
import { requireWorkspace, serviceError, refreshWorkspace } from '../data/_lib'

export async function DELETE() {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  try {
    await deleteWorkspaceData(ws)
    refreshWorkspace(ws)
    const res = NextResponse.json({ deleted: true })
    res.cookies.set(WORKSPACE_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  } catch (e) {
    return serviceError(e)
  }
}
