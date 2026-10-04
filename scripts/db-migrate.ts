/**
 * Versioned SQL migrations (db/migrations/NNNN_name.{up,down}.sql).
 *
 *   npx tsx scripts/db-migrate.ts            apply pending migrations
 *   npx tsx scripts/db-migrate.ts --status   list applied / pending
 *   npx tsx scripts/db-migrate.ts --down 0001_workspaces_imports
 *
 * Each file runs in ONE transaction with lock/statement timeouts, so a failure
 * leaves the schema untouched. Uses node-postgres over TCP (Neon included):
 * neon-http cannot run multi-statement DDL transactions.
 */
import 'dotenv/config'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const DIR = join(process.cwd(), 'db', 'migrations')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const args = process.argv.slice(2)
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    )
    const applied = new Set(
      (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    )
    const versions = readdirSync(DIR)
      .filter((f) => f.endsWith('.up.sql'))
      .map((f) => f.replace(/\.up\.sql$/, ''))
      .sort()

    if (args[0] === '--status') {
      for (const v of versions) console.log(`${applied.has(v) ? 'applied' : 'pending'}  ${v}`)
      return
    }

    if (args[0] === '--down') {
      const v = args[1]
      if (!v || !applied.has(v)) throw new Error(`--down needs an applied version (got "${v ?? ''}")`)
      console.log(`Reverting ${v}. Non-demo workspace data is deleted by this migration — back up first.`)
      await run(client, readFileSync(join(DIR, `${v}.down.sql`), 'utf8'), 'DELETE FROM schema_migrations WHERE version = $1', v)
      console.log(`reverted ${v}`)
      return
    }

    const pending = versions.filter((v) => !applied.has(v))
    if (!pending.length) return console.log('No pending migrations.')
    for (const v of pending) {
      const started = Date.now()
      await run(client, readFileSync(join(DIR, `${v}.up.sql`), 'utf8'), 'INSERT INTO schema_migrations (version) VALUES ($1)', v)
      console.log(`applied ${v} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    }
  } finally {
    await client.end()
  }
}

async function run(client: Client, sql: string, record: string, version: string) {
  await client.query('BEGIN')
  try {
    await client.query("SET LOCAL lock_timeout = '15s'")
    await client.query("SET LOCAL statement_timeout = '10min'")
    await client.query(sql)
    await client.query(record, [version])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
