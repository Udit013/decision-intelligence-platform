/**
 * POST /api/workspace/link — the caller's private recovery link. The token goes
 * in the URL fragment, which browsers never send to servers or log in history
 * requests, so it doesn't leak into access logs. Anyone holding the link can
 * open the workspace — the UI says so.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { WORKSPACE_COOKIE, isWorkspaceToken } from '@/core/tenancy'

export async function POST(req: Request) {
  const token = (await cookies()).get(WORKSPACE_COOKIE)?.value
  if (!isWorkspaceToken(token)) return NextResponse.json({ error: 'No workspace yet — reload the page.' }, { status: 401 })
  const origin = new URL(req.url).origin
  return NextResponse.json({ link: `${origin}/w#${token}` }, { headers: { 'Cache-Control': 'no-store' } })
}
