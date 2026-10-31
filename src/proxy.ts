import { NextResponse, type NextRequest } from 'next/server'
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE, isWorkspaceToken } from '@/core/tenancy'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Strict, nonce-based Content-Security-Policy (see Next.js CSP guide).
 *
 * Scripts: only same-origin files and scripts carrying this request's nonce
 * ('strict-dynamic' lets those load their chunks) — no 'unsafe-inline'.
 * Styles: nonce'd <style> and same-origin sheets; inline style *attributes*
 * (React `style={}` and ECharts) are allowed separately via style-src-attr,
 * which cannot execute script.
 */
export function buildCsp(nonce: string, opts: { dev: boolean; upgrade: boolean }) {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${opts.dev ? ' ws: wss:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(opts.upgrade ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

function newNonce() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
}

/**
 * 1. CSRF: state-changing API calls must come from this origin.
 * 2. Anonymous private workspace: a random 256-bit token in an httpOnly cookie
 *    (the database only ever sees its hash). The token is also written onto the
 *    incoming request so the very first render already sees it.
 * 3. CSP with a fresh nonce on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/') && !SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get('origin')
    let ok = false
    try {
      ok = !!origin && new URL(origin).host === request.headers.get('host')
    } catch {
      ok = false
    }
    if (!ok) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 })
  }

  // Machine endpoints (cron) neither need a workspace nor a page CSP.
  if (pathname.startsWith('/api/cron/')) return NextResponse.next()

  const nonce = newNonce()
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === 'development',
    upgrade: process.env.NODE_ENV === 'production' && request.nextUrl.hostname !== 'localhost',
  })
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)

  let token = request.cookies.get(WORKSPACE_COOKIE)?.value
  const issue = !isWorkspaceToken(token)
  if (issue) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    request.cookies.set(WORKSPACE_COOKIE, token)
    headers.set('cookie', request.cookies.toString())
  }

  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', csp)
  if (issue) {
    response.cookies.set(WORKSPACE_COOKIE, token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: WORKSPACE_COOKIE_MAX_AGE,
    })
  }
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|icon.svg|templates/|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
