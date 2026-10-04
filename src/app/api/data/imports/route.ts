/** GET /api/data/imports — the caller's import history (live and undone). */
import { NextResponse } from 'next/server'
import { listImports } from '@/server/imports'
import { requireWorkspace, serviceError } from '../_lib'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ws = await requireWorkspace()
  if (ws instanceof NextResponse) return ws
  try {
    return NextResponse.json({ imports: await listImports(ws) })
  } catch (e) {
    return serviceError(e)
  }
}
