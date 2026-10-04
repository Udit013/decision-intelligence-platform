/** POST /api/workspace/claim { token } — open a workspace from its recovery link on this browser. */
import { NextResponse } from 'next/server'
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE, isWorkspaceToken } from '@/core/tenancy'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null
  if (!isWorkspaceToken(body?.token)) return NextResponse.json({ error: 'That workspace link is not valid.' }, { status: 400 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(WORKSPACE_COOKIE, body.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  })
  return res
}
