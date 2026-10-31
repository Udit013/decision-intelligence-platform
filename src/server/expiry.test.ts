import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { TEST_DB, useTestDb, newWorkspace, wipe } from '@/test/db'
import { DEMO_WORKSPACE_ID } from '@/db/ids'

const DAY = 86_400_000

describe.skipIf(!TEST_DB)('workspace expiry (Postgres)', () => {
  let m: typeof import('./expiry')
  let getDb: typeof import('@/db').getDb
  let schema: typeof import('@/db').schema
  const made: string[] = []

  /** A workspace with a file, an import, and market rows; activity set N days ago (null = no activity row). */
  async function seed(daysAgo: number | null) {
    const ws = (await newWorkspace()).id
    made.push(ws)
    const db = getDb()
    const [imp] = await db
      .insert(schema.dataImports)
      .values({ workspaceId: ws, domain: 'market', kind: 'market.markets', label: 'seed', status: 'committed', rowsInserted: 1 })
      .returning({ id: schema.dataImports.id })
    await db.insert(schema.marketIndicators).values({ workspaceId: ws, importId: imp.id, marketKey: 'k', name: 'K' })
    await db.insert(schema.workspaceFiles).values({ workspaceId: ws, name: 'f', originalFilename: 'f.csv', format: 'csv', sizeBytes: 1, rawBase64: 'QQ==' })
    if (daysAgo !== null) {
      await db.execute(sql`INSERT INTO workspace_activity (workspace_id, last_active_at) VALUES (${ws}, now() - make_interval(days => ${daysAgo}))`)
    }
    return ws
  }
  const rowsFor = async (ws: string) => {
    const r = (await getDb().execute(sql`SELECT
      (SELECT count(*) FROM workspace_files WHERE workspace_id=${ws})::int f,
      (SELECT count(*) FROM data_imports WHERE workspace_id=${ws})::int i,
      (SELECT count(*) FROM market_indicators WHERE workspace_id=${ws})::int m,
      (SELECT count(*) FROM workspace_activity WHERE workspace_id=${ws})::int a`)) as unknown as { rows: Record<string, number>[] }
    return { files: r.rows[0].f, imports: r.rows[0].i, markets: r.rows[0].m, activity: r.rows[0].a }
  }

  beforeAll(async () => {
    useTestDb()
    m = await import('./expiry')
    ;({ getDb, schema } = await import('@/db'))
  })
  afterAll(async () => {
    await wipe(made)
  })

  it('refuses thresholds below the safety floor', async () => {
    await expect(m.expireWorkspaces({ days: 5 })).rejects.toThrow(/≥ 30/)
    await expect(m.expireWorkspaces({ days: 1.5 })).rejects.toThrow()
    await expect(m.deleteIfStale((await newWorkspace()).id, 0)).rejects.toThrow()
  })

  it('selects only workspaces inactive for the full threshold', async () => {
    const stale = await seed(91)
    const edge = await seed(89)
    const fresh = await seed(2)
    const ids = (await m.findExpired(90, 1000)).map((c) => c.workspaceId)
    expect(ids).toContain(stale)
    expect(ids).not.toContain(edge)
    expect(ids).not.toContain(fresh)
  })

  it('a dry run reports candidates and deletes nothing', async () => {
    const stale = await seed(120)
    const report = await m.expireWorkspaces({ dryRun: true, limit: 1000 })
    const c = report.candidates.find((x) => x.workspaceId === stale)!
    expect(c).toMatchObject({ files: 1, imports: 1 })
    expect(report.expired).toBe(0)
    expect(await rowsFor(stale)).toEqual({ files: 1, imports: 1, markets: 1, activity: 1 })
  })

  it('applying deletes files, imports, rows and the activity record of stale workspaces only', async () => {
    const stale = await seed(200)
    const fresh = await seed(10)
    const untracked = await seed(null)
    const report = await m.expireWorkspaces({ dryRun: false, limit: 1000 })
    expect(report.expired).toBeGreaterThanOrEqual(1)
    expect(await rowsFor(stale)).toEqual({ files: 0, imports: 0, markets: 0, activity: 0 })
    expect(await rowsFor(fresh)).toEqual({ files: 1, imports: 1, markets: 1, activity: 1 })
    // Data with no activity record cannot be proven expired: it is kept and reported.
    expect(await rowsFor(untracked)).toEqual({ files: 1, imports: 1, markets: 1, activity: 0 })
    expect(report.untrackedWorkspaces).toBeGreaterThanOrEqual(1)
  })

  it('re-checks staleness at delete time: a workspace touched after selection survives', async () => {
    const ws = await seed(150)
    expect((await m.findExpired(90, 1000)).map((c) => c.workspaceId)).toContain(ws)
    await getDb().execute(sql`UPDATE workspace_activity SET last_active_at = now() WHERE workspace_id = ${ws}`)
    await m.deleteIfStale(ws, 90)
    expect(await rowsFor(ws)).toEqual({ files: 1, imports: 1, markets: 1, activity: 1 })
  })

  it('never touches the demo workspace', async () => {
    const before = (await getDb().execute(sql`SELECT count(*)::int n FROM data_imports WHERE workspace_id = ${DEMO_WORKSPACE_ID}`)) as unknown as { rows: { n: number }[] }
    await expect(m.deleteIfStale(DEMO_WORKSPACE_ID, 90)).rejects.toThrow(/never expires/)
    await m.touchWorkspace(DEMO_WORKSPACE_ID)
    await m.expireWorkspaces({ dryRun: false, limit: 1000 })
    const after = (await getDb().execute(sql`SELECT count(*)::int n FROM data_imports WHERE workspace_id = ${DEMO_WORKSPACE_ID}`)) as unknown as { rows: { n: number }[] }
    expect(after.rows[0].n).toBe(before.rows[0].n)
    const act = (await getDb().execute(sql`SELECT count(*)::int n FROM workspace_activity WHERE workspace_id = ${DEMO_WORKSPACE_ID}`)) as unknown as { rows: { n: number }[] }
    expect(act.rows[0].n).toBe(0)
  })

  it('touching refreshes activity, at most hourly', async () => {
    const ws = await seed(100)
    await m.touchWorkspace(ws)
    const first = (await getDb().execute(sql`SELECT last_active_at FROM workspace_activity WHERE workspace_id=${ws}`)) as unknown as { rows: { last_active_at: string }[] }
    expect(Date.now() - new Date(first.rows[0].last_active_at).getTime()).toBeLessThan(DAY)
    await m.touchWorkspace(ws) // within the hour: no further write
    const second = (await getDb().execute(sql`SELECT last_active_at FROM workspace_activity WHERE workspace_id=${ws}`)) as unknown as { rows: { last_active_at: string }[] }
    expect(second.rows[0].last_active_at).toBe(first.rows[0].last_active_at)
  })
})
