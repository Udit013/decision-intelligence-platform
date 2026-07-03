import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'

/**
 * Deployment diagnostic: confirms the deployed DATABASE_URL points at a seeded
 * database and reports query latency. GET /api/operations/health →
 *   { status: "ok" | "empty" | "error", counts, latencyMs }
 * Read-only and uncached on purpose — it measures the live DB, not the cache.
 */
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const firstRow = (res: any) => (Array.isArray(res) ? res[0] : res?.rows?.[0])

export async function GET() {
  const started = Date.now()
  try {
    const db = getDb()
    const row = firstRow(
      await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM operations_invoice_lines)::int AS lines,
          (SELECT COUNT(*) FROM operations_invoices)::int AS invoices,
          (SELECT COUNT(*) FROM operations_customers)::int AS customers,
          (SELECT COUNT(*) FROM operations_products)::int AS products
      `),
    )
    const counts = {
      invoiceLines: Number(row?.lines ?? 0),
      invoices: Number(row?.invoices ?? 0),
      customers: Number(row?.customers ?? 0),
      products: Number(row?.products ?? 0),
    }
    const status = counts.invoiceLines > 0 ? 'ok' : 'empty'
    return NextResponse.json(
      { status, counts, latencyMs: Date.now() - started },
      { status: status === 'ok' ? 200 : 503 },
    )
  } catch (e) {
    return NextResponse.json(
      { status: 'error', error: (e as Error).message, latencyMs: Date.now() - started },
      { status: 503 },
    )
  }
}
