import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { TEST_DB, useTestDb, newWorkspace } from '@/test/db'
import { clientIp, windowIndex, LIMITS } from './ratelimit'

describe('rate-limit helpers', () => {
  it('derives fixed windows', () => {
    expect(windowIndex(0, 60)).toBe(0)
    expect(windowIndex(59_999, 60)).toBe(0)
    expect(windowIndex(60_000, 60)).toBe(1)
  })
  it('prefers x-real-ip, then the first x-forwarded-for hop', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

describe.skipIf(!TEST_DB)('rate limiting (Postgres)', () => {
  let consume: typeof import('./ratelimit').consume
  let getDb: typeof import('@/db').getDb
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)
  const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

  beforeAll(async () => {
    useTestDb()
    ;({ consume } = await import('./ratelimit'))
    ;({ getDb } = await import('@/db'))
  })
  afterAll(async () => {
    await getDb().execute(sql`DELETE FROM rate_limits WHERE bucket LIKE 'ws:%' OR bucket LIKE 'ip:%'`)
  })

  it('allows up to the limit, then blocks with a retry hint', async () => {
    const ws = (await newWorkspace()).id
    const addr = ip()
    const max = LIMITS.commitImport.limit
    for (let i = 0; i < max; i++) expect((await consume('commitImport', { workspaceId: ws, ip: addr }, NOW)).ok).toBe(true)
    const blocked = await consume('commitImport', { workspaceId: ws, ip: addr }, NOW)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(LIMITS.commitImport.windowSec)
  })

  it('counts workspaces and actions independently', async () => {
    const a = (await newWorkspace()).id
    const b = (await newWorkspace()).id
    for (let i = 0; i < LIMITS.commitImport.limit + 1; i++) await consume('commitImport', { workspaceId: a, ip: ip() }, NOW)
    expect((await consume('commitImport', { workspaceId: a, ip: ip() }, NOW)).ok).toBe(false)
    expect((await consume('commitImport', { workspaceId: b, ip: ip() }, NOW)).ok).toBe(true)
    expect((await consume('undoImport', { workspaceId: a, ip: ip() }, NOW)).ok).toBe(true)
  })

  it('limits by address even when the workspace cookie is discarded each time', async () => {
    const addr = ip()
    const ceiling = LIMITS.commitImport.limit * LIMITS.commitImport.ipFactor
    for (let i = 0; i < ceiling; i++) expect((await consume('commitImport', { workspaceId: (await newWorkspace()).id, ip: addr }, NOW)).ok).toBe(true)
    expect((await consume('commitImport', { workspaceId: (await newWorkspace()).id, ip: addr }, NOW)).ok).toBe(false)
  })

  it('resets in the next window', async () => {
    const ws = (await newWorkspace()).id
    const addr = ip()
    for (let i = 0; i < LIMITS.commitImport.limit + 1; i++) await consume('commitImport', { workspaceId: ws, ip: addr }, NOW)
    expect((await consume('commitImport', { workspaceId: ws, ip: addr }, NOW)).ok).toBe(false)
    expect((await consume('commitImport', { workspaceId: ws, ip: addr }, NOW + LIMITS.commitImport.windowSec * 1000)).ok).toBe(true)
  })

  it('never stores a raw IP address', async () => {
    const addr = '203.0.113.77'
    await consume('advisor', { ip: addr }, NOW)
    const r = (await getDb().execute(sql`SELECT bucket FROM rate_limits WHERE bucket LIKE 'ip:advisor:%'`)) as unknown as { rows: { bucket: string }[] }
    expect(r.rows.length).toBeGreaterThan(0)
    expect(r.rows.some((x) => x.bucket.includes(addr))).toBe(false)
  })
})
