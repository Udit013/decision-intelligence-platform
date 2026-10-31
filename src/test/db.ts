import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'

export const TEST_DB = process.env.TEST_DATABASE_URL

/** Point the app's db client at the test database (call before importing app modules). */
export function useTestDb() {
  process.env.DATABASE_URL = TEST_DB
}

/** A fresh, valid capability token (43 base64url chars) and its workspace id. */
export async function newWorkspace() {
  const { workspaceIdFromToken } = await import('@/server/workspace-id')
  const token = Buffer.from(randomUUID() + randomUUID()).toString('base64url').slice(0, 43)
  return { token, id: workspaceIdFromToken(token) }
}

/** Remove every row belonging to the given workspaces (test hygiene). */
export async function wipe(ids: string[]) {
  const { getDb } = await import('@/db')
  const db = getDb()
  for (const id of ids) {
    for (const t of [
      'operations_invoice_lines', 'operations_invoices', 'operations_customers', 'operations_products',
      'market_indicators', 'market_competitors', 'product_tracked_events', 'product_experiment_stats',
      'product_backlog_items', 'data_imports', 'workspace_files', 'workspace_activity',
    ]) await db.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE workspace_id = ${id}`)
  }
}
