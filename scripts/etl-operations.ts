/**
 * ETL: UCI Online Retail II (.xlsx) → Neon Postgres (operations_* tables).
 *
 * Prints a DATA-QUALITY report PRE-SEED (you see what you're loading before any
 * write), then normalizes into customers / products / invoices / invoice_lines.
 * The derived category + assumed cost ratio (see src/domains/operations/assumptions)
 * are written to operations_products and clearly flagged as estimates everywhere.
 *
 * Run (after `npm run db:push` and with DATABASE_URL set):
 *   npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
 */
import 'dotenv/config'
import { getDb } from '../src/db/index'
import {
  operationsCustomers,
  operationsProducts,
  operationsInvoices,
  operationsInvoiceLines,
  operationsEtlLogs,
} from '../src/db/schema'
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
    sql`SELECT COUNT(*)::int AS c FROM operations_invoice_lines`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any
  const existing = Number((Array.isArray(countRes) ? countRes[0] : countRes.rows?.[0])?.c ?? 0)
  if (existing > 0) {
    if (!process.argv.includes('--force')) {
      console.error(
        `\n✗ operations_invoice_lines already has ${existing.toLocaleString()} rows.` +
          `\n  Re-running would duplicate every metric. To wipe and reload, run with --force.\n`,
      )
      process.exit(1)
    }
    console.log(`--force: truncating existing operations data (${existing.toLocaleString()} lines)...`)
    await db.execute(
      sql`TRUNCATE operations_invoice_lines, operations_invoices, operations_customers, operations_products`,
    )
  }

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
    return { stockCode, description, category, assumedCostRatio: assumedCostRatioFor(category) }
  })
  await chunkInsert(productRows, 1000, (b) => db.insert(operationsProducts).values(b).onConflictDoNothing())

  console.log('→ customers')
  const customerRows = [...customers.entries()].map(([customerId, c]) => ({
    customerId,
    country: c.country,
    firstSeen: c.first,
    lastSeen: c.last,
  }))
  await chunkInsert(customerRows, 1000, (b) => db.insert(operationsCustomers).values(b).onConflictDoNothing())

  console.log('→ invoices')
  const invoiceRows = [...invoices.entries()].map(([invoice, v]) => ({
    invoice,
    invoiceDate: v.date,
    customerId: v.customerId,
    country: v.country,
    isReturn: v.isReturn,
  }))
  await chunkInsert(invoiceRows, 1000, (b) => db.insert(operationsInvoices).values(b).onConflictDoNothing())

  console.log('→ invoice_lines')
  await chunkInsert(lines, 1000, (b) => db.insert(operationsInvoiceLines).values(b))

  await db.insert(operationsEtlLogs).values({
    source: 'UCI Online Retail II',
    totalRows: q.totalRows,
    insertedRows: lines.length,
    skippedRows: q.totalRows - lines.length,
    notes: `clean=${q.cleanSaleRows}, cancellations=${q.cancellations}, missingCustomerId=${q.missingCustomerId}, duplicates=${q.exactDuplicates}`,
  })

  console.log('\n✓ ETL complete.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
