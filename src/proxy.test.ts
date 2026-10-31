import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy, buildCsp } from './proxy'
import { WORKSPACE_COOKIE, isWorkspaceToken } from '@/core/tenancy'

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`https://app.example${path}`, { method: init.method ?? 'GET', headers: { host: 'app.example', ...init.headers } })

const setCookie = (res: Response) => res.headers.get('set-cookie') ?? ''

describe('proxy — workspace cookie', () => {
  it('issues a valid, httpOnly, SameSite=Lax capability cookie on first visit', () => {
    const c = setCookie(proxy(req('/')))
    expect(c).toContain(`${WORKSPACE_COOKIE}=`)
    expect(c.toLowerCase()).toContain('httponly')
    expect(c.toLowerCase()).toContain('samesite=lax')
    const token = c.match(new RegExp(`${WORKSPACE_COOKIE}=([^;]+)`))![1]
    expect(isWorkspaceToken(token)).toBe(true)
  })
  it('issues a different token to every new visitor', () => {
    const t = () => setCookie(proxy(req('/'))).match(new RegExp(`${WORKSPACE_COOKIE}=([^;]+)`))![1]
    expect(t()).not.toBe(t())
  })
  it('keeps an existing valid cookie untouched', () => {
    const res = proxy(req('/', { headers: { cookie: `${WORKSPACE_COOKIE}=${'A'.repeat(43)}` } }))
    expect(setCookie(res)).toBe('')
  })
  it('replaces a malformed cookie instead of trusting it', () => {
    const res = proxy(req('/', { headers: { cookie: `${WORKSPACE_COOKIE}=not-a-token` } }))
    expect(isWorkspaceToken(setCookie(res).match(new RegExp(`${WORKSPACE_COOKIE}=([^;]+)`))![1])).toBe(true)
  })
  it('does not issue cookies to the cron endpoint', () => {
    expect(setCookie(proxy(req('/api/cron/expire-workspaces')))).toBe('')
  })
})

describe('proxy — CSRF', () => {
  const post = (headers: Record<string, string> = {}) => proxy(req('/api/data/upload', { method: 'POST', headers }))
  it('rejects state-changing API calls with no Origin', () => expect(post().status).toBe(403))
  it('rejects a cross-origin Origin', () => expect(post({ origin: 'https://evil.example' }).status).toBe(403))
  it('rejects a malformed Origin', () => expect(post({ origin: 'null' }).status).toBe(403))
  it('allows the same origin', () => expect(post({ origin: 'https://app.example' }).status).not.toBe(403))
  it('does not gate safe methods', () => expect(proxy(req('/api/data/files')).status).not.toBe(403))
})

describe('proxy — Content-Security-Policy', () => {
  const csp = (res: Response) => res.headers.get('content-security-policy') ?? ''
  it('sets a policy with a per-request nonce', () => {
    const a = csp(proxy(req('/')))
    const b = csp(proxy(req('/')))
    const nonce = (s: string) => s.match(/'nonce-([^']+)'/)![1]
    expect(nonce(a)).not.toBe(nonce(b))
    expect(nonce(a).length).toBeGreaterThanOrEqual(20)
  })
  it('allows no inline or eval scripts and no foreign origins in production', () => {
    const p = buildCsp('N', { dev: false, upgrade: true })
    const script = p.split('; ').find((d) => d.startsWith('script-src '))!
    expect(script).toBe("script-src 'self' 'nonce-N' 'strict-dynamic'")
    expect(p).not.toContain('unsafe-eval')
    expect(p).not.toMatch(/https?:\/\//)
    for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests']) expect(p).toContain(d)
  })
  it('only permits unsafe-eval in development', () => {
    expect(buildCsp('N', { dev: true, upgrade: false })).toContain("'unsafe-eval'")
  })
})
