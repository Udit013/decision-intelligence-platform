/**
 * Database client.
 *
 * Neon (production) → neon-http: stateless HTTPS queries, ideal for serverless.
 * Any other Postgres (local dev, tests, self-hosting) → node-postgres pool.
 * Both expose the same Drizzle query API; `atomic()` papers over their one
 * difference — neon-http has no interactive transactions, only `batch()`.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neon } from '@neondatabase/serverless'
import { Pool } from 'pg'
import type { BatchItem } from 'drizzle-orm/batch'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzleNeon<typeof schema>>

let _db: Db | null = null
let _driver: 'neon' | 'pg' = 'neon'

export function isNeonUrl(url: string) {
  return /\.neon\.tech(:\d+)?\//.test(url) || /\.neon\.build(:\d+)?\//.test(url)
}

export function getDb(): Db {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — configure it in .env (see .env.example).')
  if (isNeonUrl(url)) {
    _driver = 'neon'
    _db = drizzleNeon(neon(url), { schema })
  } else {
    _driver = 'pg'
    // Same query-builder surface; `execute()` also returns `{ rows }`.
    _db = drizzlePg(new Pool({ connectionString: url, max: 5 }), { schema }) as unknown as Db
  }
  return _db
}

/** Runs the statements built by `build` as ONE transaction (all or nothing). */
export async function atomic(build: (q: Db) => BatchItem<'pg'>[]): Promise<unknown[]> {
  const db = getDb()
  if (_driver === 'neon') {
    const queries = build(db)
    if (!queries.length) return []
    return db.batch(queries as [BatchItem<'pg'>, ...BatchItem<'pg'>[]])
  }
  const pgDb = db as unknown as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }
  return pgDb.transaction(async (tx) => {
    const out: unknown[] = []
    for (const q of build(tx)) out.push(await q)
    return out
  })
}

export { schema }
