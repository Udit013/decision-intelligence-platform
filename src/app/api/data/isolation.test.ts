/**
 * Cross-workspace isolation through the real route handlers (mocked cookies,
 * real Postgres). Workspace B must be unable to see, change, import from, or
 * undo anything belonging to workspace A — every attempt is indistinguishable
 * from "does not exist".
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { TEST_DB, useTestDb, newWorkspace, wipe } from '@/test/db'

let currentToken: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n === 'csiq_ws' && currentToken ? { name: n, value: currentToken } : undefined) }),
}))
vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }))

const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe.skipIf(!TEST_DB)('workspace isolation (routes + Postgres)', () => {
  let A: { token: string; id: string }
  let B: { token: string; id: string }
  let routes: {
    upload: typeof import('./upload/route').POST
    list: typeof import('./files/route').GET
    file: typeof import('./files/[id]/route')
    imp: typeof import('./files/[id]/import/route').POST
    undo: typeof import('./imports/[id]/undo/route').POST
    imports: typeof import('./imports/route').GET
  }
  let fileId: string
  let importId: string

  const as = (w: { token: string } | null) => void (currentToken = w?.token)
  const csv = () => {
    const f = new FormData()
    f.set('file', new File(['Experiment,Variant,Users,Conversions\nT,control,100,10\nT,b,100,20\n'], 'exp.csv', { type: 'text/csv' }))
    return new Request('http://x/api/data/upload', { method: 'POST', body: f })
  }

  beforeAll(async () => {
    useTestDb()
    A = await newWorkspace()
    B = await newWorkspace()
    routes = {
      upload: (await import('./upload/route')).POST,
      list: (await import('./files/route')).GET,
      file: await import('./files/[id]/route'),
      imp: (await import('./files/[id]/import/route')).POST,
      undo: (await import('./imports/[id]/undo/route')).POST,
      imports: (await import('./imports/route')).GET,
    }
    as(A)
    const up = await routes.upload(csv())
    expect(up.status).toBe(201)
    fileId = (await up.json()).file.id
    const done = await routes.imp(new Request('http://x', json({ kind: 'product.experiments' })), ctx(fileId))
    expect(done.status).toBe(201)
    importId = (await done.json()).import.importId
  })
  afterAll(async () => {
    await wipe([A.id, B.id])
  })

  it('rejects requests with no cookie or a malformed cookie (401)', async () => {
    as(null)
    expect((await routes.list(new Request('http://x/api/data/files'))).status).toBe(401)
    expect((await routes.upload(csv())).status).toBe(401)
    currentToken = 'not-a-valid-token'
    expect((await routes.list(new Request('http://x/api/data/files'))).status).toBe(401)
    expect((await routes.imports()).status).toBe(401)
  })

  it('owner sees their own file and import', async () => {
    as(A)
    const files = (await (await routes.list(new Request('http://x/api/data/files'))).json()).files
    expect(files.map((f: { id: string }) => f.id)).toContain(fileId)
    expect((await (await routes.imports()).json()).imports.map((i: { id: string }) => i.id)).toContain(importId)
  })

  it("another workspace cannot list, read, rename, delete, re-parse, import from, or undo the owner's data", async () => {
    as(B)
    const list = (await (await routes.list(new Request('http://x/api/data/files'))).json()).files
    expect(list).toEqual([])
    expect((await (await routes.imports()).json()).imports).toEqual([])

    expect((await routes.file.GET(new Request('http://x'), ctx(fileId))).status).toBe(404)
    expect((await routes.file.PATCH(new Request('http://x', { ...json({ name: 'pwned' }), method: 'PATCH' }), ctx(fileId))).status).toBe(404)
    expect((await routes.file.DELETE(new Request('http://x', { method: 'DELETE' }), ctx(fileId))).status).toBe(404)
    expect((await routes.imp(new Request('http://x', json({ kind: 'product.experiments', dryRun: true })), ctx(fileId))).status).toBe(404)
    expect((await routes.imp(new Request('http://x', json({ kind: 'product.experiments' })), ctx(fileId))).status).toBe(404)
    expect((await routes.undo(new Request('http://x', { method: 'POST' }), ctx(importId))).status).toBe(404)
  })

  it("the owner's data is untouched by those attempts", async () => {
    as(A)
    const res = await routes.file.GET(new Request('http://x'), ctx(fileId))
    expect(res.status).toBe(200)
    expect((await res.json()).file.name).toBe('exp')
    const imports = (await (await routes.imports()).json()).imports
    expect(imports.find((i: { id: string }) => i.id === importId).status).toBe('committed')
  })

  it("an identical file imported by B lands in B's workspace only", async () => {
    as(B)
    const up = await routes.upload(csv())
    const bFile = (await up.json()).file.id
    const done = await routes.imp(new Request('http://x', json({ kind: 'product.experiments' })), ctx(bFile))
    expect(done.status).toBe(201) // same bytes as A's file — not treated as a duplicate across workspaces
    as(A)
    expect((await (await routes.imports()).json()).imports).toHaveLength(1)
  })

  it('forged workspace ids in the request body are ignored', async () => {
    as(B)
    const f = new FormData()
    f.set('file', new File(['a,b\n1,2\n'], 'x.csv'))
    f.set('workspaceId', A.id)
    const up = await routes.upload(new Request('http://x/api/data/upload', { method: 'POST', body: f }))
    const id = (await up.json()).file.id
    as(A)
    expect((await routes.file.GET(new Request('http://x'), ctx(id))).status).toBe(404)
  })
})
