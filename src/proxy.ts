import { NextResponse, type NextRequest } from 'next/server'
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE, isWorkspaceToken } from '@/core/tenancy'

/**
 * Gives every visitor an anonymous private workspace: a random 256-bit token in
 * an httpOnly cookie. The server derives the workspace id from its hash, so the
 * token itself is never stored. The new token is also written onto the incoming
 * request so the very first render already sees it.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function proxy(request: NextRequest) {
  // CSRF: state-changing API calls must come from this origin. (SameSite=Lax
  // already withholds cookies cross-site; this also covers routes that SET one.)
  if (request.nextUrl.pathname.startsWith('/api/') && !SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get('origin')
    if (!origin || new URL(origin).host !== request.headers.get('host')) {
      return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 })
    }
  }

  if (isWorkspaceToken(request.cookies.get(WORKSPACE_COOKIE)?.value)) return NextResponse.next()

  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  request.cookies.set(WORKSPACE_COOKIE, token)
  const headers = new Headers(request.headers)
  headers.set('cookie', request.cookies.toString())
  const response = NextResponse.next({ request: { headers } })
  response.cookies.set(WORKSPACE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  })
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|templates/|favicon.ico).*)'],
}
