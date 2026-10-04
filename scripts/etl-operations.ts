/**
 * ETL: UCI Online Retail II (.xlsx) → the read-only DEMO workspace's
 * operations_* tables (visitor workspaces are never touched).
 *
 * Prints a DATA-QUALITY report PRE-SEED (you see what you're loading before any
 * write), then normalizes into customers / products / invoices / invoice_lines.
 * The derived category + assumed cost ratio (see src/domains/operations/assumptions)
 * are written to operations_products and clearly flagged as estimates everywhere.
 *
 * Run (after `npm run db:migrate` and with DATABASE_URL set):
 *   npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
 */
import 'dotenv/config'
import { getDb } from '../src/db/index'
import {
  dataImports,
  operationsCustomers,
  operationsProducts,
  operationsInvoices,
  operationsInvoiceLines,
} from '../src/db/schema'
import { DEMO_WORKSPACE_ID, DEMO_OPERATIONS_IMPORT_ID } from '../src/db/ids'
import { loadRetailRows, profile, printQuality } from './lib/load-retail'
import { deriveCategory, assumedCostRatioFor } from '../src/domains/operations/assumptions'

async function chunkInsert<T>(rows: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size))
    if (i % (size * 20) === 0) process.stdout.write(`\r  ...${Math.min(i + size, rows.length)}/${rows.length}`)
  }
  process.stdout.write('\n')
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set (see .env.example).')

  const db = getDb()

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // Dimension tables upsert on natural keys, but invoice_lines have random-UUID
  // PKs — a plain re-run would silently DOUBLE every line and every metric.
  // Refuse to seed over existing data unless --force, which wipes and reloads.
  const { sql } = await import('drizzle-orm')
  const countRes = (await db.execute(
    sql`SELECT COUNT(*)::int AS c FROM operations_invoice_lines WHERE workspace_id = ${DEMO_WORKSPACE_ID}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any
  const existing = Number((Array.isArray(countRes) ? countRes[0] : countRes.rows?.[0])?.c ?? 0)
  if (existing > 0) {
    if (!process.argv.includes('--force')) {
      console.error(
        `\n✗ The demo workspace already has ${existing.toLocaleString()} order lines.` +
          `\n  Re-running would duplicate every metric. To wipe and reload, run with --force.\n`,
      )
      process.exit(1)
    }
    console.log(`--force: removing the demo workspace's operations data (${existing.toLocaleString()} lines)...`)
    for (const t of ['operations_invoice_lines', 'operations_invoices', 'operations_customers', 'operations_products']) {
      await db.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE workspace_id = ${DEMO_WORKSPACE_ID}`)
    }
  }
  // The import ledger row that owns the sample (lines reference it by FK).
  await db.delete(dataImports).where(sql`${dataImports.id} = ${DEMO_OPERATIONS_IMPORT_ID}`)
  await db.insert(dataImports).values({
    id: DEMO_OPERATIONS_IMPORT_ID,
    workspaceId: DEMO_WORKSPACE_ID,
    domain: 'operations',
    kind: 'operations.order_lines',
    label: 'UCI Online Retail II — sample dataset (CLI ETL)',
    status: 'committed',
    committedAt: new Date(),
  })

  console.log('Loading workbook...')
  const rows = loadRetailRows()
  const q = profile(rows)
  printQuality(q) // ← PRE-SEED visibility

  // ── Dimensions ──
  const customers = new Map<string, { country: string | null; first: Date; last: Date }>()
  const products = new Map<string, string | null>()
  const invoices = new Map<string, { date: Date; customerId: string | null; country: string | null; isReturn: boolean }>()
  const lines: (typeof operationsInvoiceLines.$inferInsert)[] = []

  for (const r of rows) {
    if (!products.has(r.stockCode)) products.set(r.stockCode, r.description)

    if (r.customerId) {
      const c = customers.get(r.customerId)
      if (!c) customers.set(r.customerId, { country: r.country, first: r.invoiceDate, last: r.invoiceDate })
      else {
        if (r.invoiceDate < c.first) c.first = r.invoiceDate
        if (r.invoiceDate > c.last) c.last = r.invoiceDate
      }
    }

    const inv = invoices.get(r.invoice)
    if (!inv) invoices.set(r.invoice, { date: r.invoiceDate, customerId: r.customerId, country: r.country, isReturn: r.isCancellation })
    else if (r.invoiceDate < inv.date) inv.date = r.invoiceDate

    lines.push({
      workspaceId: DEMO_WORKSPACE_ID,
      importId: DEMO_OPERATIONS_IMPORT_ID,
      invoice: r.invoice,
      stockCode: r.stockCode,
      quantity: r.quantity,
      unitPrice: r.price,
      lineRevenue: Math.round(r.quantity * r.price * 100) / 100,
      invoiceDate: r.invoiceDate,
    })
  }

  console.log(`\nSeeding: ${customers.size} customers, ${products.size} products, ${invoices.size} invoices, ${lines.length} lines`)

  console.log('→ products')
  const productRows = [...products.entries()].map(([stockCode, description]) => {
    const category = deriveCategory(description)
    return { workspaceId: DEMO_WORKSPACE_ID, stockCode, description, category, assumedCostRatio: assumedCostRatioFor(category) }
  })
  await chunkInsert(productRows, 1000, (b) => db.insert(operationsProducts).values(b).onConflictDoNothing())

  console.log('→ customers')
  const customerRows = [...customers.entries()].map(([customerId, c]) => ({
    workspaceId: DEMO_WORKSPACE_ID,
    customerId,
    country: c.country,
    firstSeen: c.first,
    lastSeen: c.last,
  }))
  await chunkInsert(customerRows, 1000, (b) => db.insert(operationsCustomers).values(b).onConflictDoNothing())

  console.log('→ invoices')
  const invoiceRows = [...invoices.entries()].map(([invoice, v]) => ({
    workspaceId: DEMO_WORKSPACE_ID,
    invoice,
    invoiceDate: v.date,
    customerId: v.customerId,
    country: v.country,
    isReturn: v.isReturn,
  }))
  await chunkInsert(invoiceRows, 1000, (b) => db.insert(operationsInvoices).values(b).onConflictDoNothing())

  console.log('→ invoice_lines')
  await chunkInsert(lines, 1000, (b) => db.insert(operationsInvoiceLines).values(b))

  await db
    .update(dataImports)
    .set({ rowsTotal: q.totalRows, rowsInserted: lines.length, rowsSkipped: q.totalRows - lines.length })
    .where(sql`${dataImports.id} = ${DEMO_OPERATIONS_IMPORT_ID}`)
  console.log(`quality: clean=${q.cleanSaleRows}, cancellations=${q.cancellations}, missingCustomerId=${q.missingCustomerId}, duplicates=${q.exactDuplicates}`)

  console.log('\n✓ ETL complete.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
