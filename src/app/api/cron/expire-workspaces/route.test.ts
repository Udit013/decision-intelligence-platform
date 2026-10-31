import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { TEST_DB, useTestDb, newWorkspace, wipe } from '@/test/db'

describe('cron endpoint authorization', () => {
  let GET: typeof import('./route').GET
  const original = process.env.CRON_SECRET
  beforeAll(async () => {
    ;({ GET } = await import('./route'))
  })
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  })
  const call = (auth?: string) => GET(new Request('http://x/api/cron/expire-workspaces?dryRun=1', { headers: auth ? { authorization: auth } : {} }))

  it('fails closed (503) when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    expect((await call('Bearer anything')).status).toBe(503)
  })
  it('rejects missing, wrong, and same-length-but-different credentials (401)', async () => {
    process.env.CRON_SECRET = 'correct-horse-battery'
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect((await call('Bearer correct-horse-batterz')).status).toBe(401)
    expect((await call('correct-horse-battery')).status).toBe(401)
  })
})

describe.skipIf(!TEST_DB)('cron endpoint (Postgres)', () => {
  const made: string[] = []
  let GET: typeof import('./route').GET
  let getDb: typeof import('@/db').getDb
  beforeAll(async () => {
    useTestDb()
    process.env.CRON_SECRET = 'test-secret'
    ;({ GET } = await import('./route'))
    ;({ getDb } = await import('@/db'))
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterAll(async () => {
    delete process.env.CRON_SECRET
    await wipe(made)
  })

  it('with the right secret: ?dryRun=1 deletes nothing, a real run deletes the stale workspace', async () => {
    const ws = (await newWorkspace()).id
    made.push(ws)
    const db = getDb()
    await db.execute(sql`INSERT INTO workspace_files (workspace_id, name, original_filename, format, size_bytes, raw_base64) VALUES (${ws}, 'n', 'n.csv', 'csv', 1, 'QQ==')`)
    await db.execute(sql`INSERT INTO workspace_activity (workspace_id, last_active_at) VALUES (${ws}, now() - interval '100 days')`)
    const count = async () => ((await db.execute(sql`SELECT count(*)::int n FROM workspace_files WHERE workspace_id=${ws}`)) as unknown as { rows: { n: number }[] }).rows[0].n
    const auth = { authorization: 'Bearer test-secret' }

    const dry = await GET(new Request('http://x/api/cron/expire-workspaces?dryRun=1', { headers: auth }))
    expect(dry.status).toBe(200)
    expect((await dry.json()).dryRun).toBe(true)
    expect(await count()).toBe(1)

    const real = await GET(new Request('http://x/api/cron/expire-workspaces', { headers: auth }))
    expect((await real.json()).expired).toBeGreaterThanOrEqual(1)
    expect(await count()).toBe(0)
  })
})
