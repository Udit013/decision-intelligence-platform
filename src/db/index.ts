/**
 * Database client — Neon serverless driver over HTTP.
 *
 * Works the same locally and on Vercel (no connection pooling to manage). When
 * DATABASE_URL is unset the proxy throws on first use, so pages/handlers that
 * don't touch the DB still render — keeping the demo resilient.
 */
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set — configure it in .env (see .env.example).')
  }
  _db = drizzle(neon(url), { schema })
  return _db
}

export { schema }
