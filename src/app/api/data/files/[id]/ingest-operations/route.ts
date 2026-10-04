/**
 * POST /api/data/files/[id]/ingest-operations — load a tabular workspace file
 * into the Operations schema so it powers the real analytics.
 *
 * Guards: tabular + parsed OK, required columns mappable, ≤ INGEST_ROW_LIMIT
 * rows (bigger loads → CLI ETL), and not already ingested (would double
 * metrics; upload again or replace to re-ingest). On success the operations
 * cache tag is revalidated so every page reflects the new data immediately.
 */
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { getDb } from '@/db'
import {
  workspaceFiles,
  operationsCustomers,
  operationsProducts,
  operationsInvoices,
  operationsInvoiceLines,
  operationsEtlLogs,
} from '@/db/schema'
import { parseBuffer, isTabular, type FileFormat } from '@/core/workspace'
import { mapColumns, buildRecords, INGEST_ROW_LIMIT } from '@/domains/operations/ingest'
import { badRequest, dbUnavailable } from '../../../_lib'

export const maxDuration = 60

const CHUNK = 1000

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK))
  return out
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  try {
    const db = getDb()
    const [file] = await db.select().from(workspaceFiles).where(eq(workspaceFiles.id, id))
    if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

    if (!isTabular(file.format as FileFormat)) return badRequest(`${file.format.toUpperCase()} files cannot be ingested — only CSV, XLSX, or JSON.`)
    if (file.status !== 'ready') return badRequest(`File is in "${file.status}" state — fix or reprocess it first.`)
    if (file.ingestedAt) {
      return badRequest('This file was already ingested — ingesting again would double its metrics. Replace the file (or upload a new one) to load different data.')
    }

    const parsed = parseBuffer(file.format as FileFormat, new Uint8Array(Buffer.from(file.rawBase64, 'base64')))
    if (!parsed.table) return badRequest(parsed.error ?? 'File could not be parsed.')
    if (parsed.table.rowCount > INGEST_ROW_LIMIT) {
      return badRequest(`File has ${parsed.table.rowCount.toLocaleString()} rows — the in-app limit is ${INGEST_ROW_LIMIT.toLocaleString()}. Use the CLI ETL for large loads (see README).`)
    }

    const { mapping, missing } = mapColumns(parsed.table.columns)
    if (missing.length) {
      return badRequest(
        `Missing required column(s): ${missing.join(', ')}. Found: ${parsed.table.columns.join(', ')}. ` +
          `Headers like "Invoice/Order ID", "SKU/StockCode", "Quantity", "Price", "Date" are auto-detected.`,
      )
    }

    const rec = buildRecords(parsed.table.rows, mapping)
    if (!rec.lines.length) return badRequest(`No valid rows after validation (${rec.skipped} skipped — check number and date formats).`)

    // Claim the file atomically so concurrent requests (double-click, retries)
    // cannot both pass the ingestedAt guard and double-insert lines.
    const claimed = await db
      .update(workspaceFiles)
      .set({ ingestedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workspaceFiles.id, id), isNull(workspaceFiles.ingestedAt)))
      .returning({ id: workspaceFiles.id })
    if (!claimed.length) {
      return NextResponse.json({ error: 'This file is already being ingested or was ingested.' }, { status: 409 })
    }

    // neon-http has no interactive transactions; batch() runs as one transaction,
    // so a failure mid-load leaves no partial rows behind.
    try {
      const inserts: BatchItem<'pg'>[] = [
        ...chunks(rec.products).map((b) => db.insert(operationsProducts).values(b).onConflictDoNothing()),
        ...chunks(rec.customers).map((b) => db.insert(operationsCustomers).values(b).onConflictDoNothing()),
        ...chunks(rec.invoices).map((b) => db.insert(operationsInvoices).values(b).onConflictDoNothing()),
        ...chunks(rec.lines).map((b) => db.insert(operationsInvoiceLines).values(b)),
      ]
      const etlLog = db.insert(operationsEtlLogs).values({
        source: `workspace upload: ${file.name} (${file.originalFilename})`,
        totalRows: parsed.table.rowCount,
        insertedRows: rec.lines.length,
        skippedRows: rec.skipped,
        notes: `in-app ingest; file ${file.id}`,
      })
      await db.batch([etlLog, ...inserts])
    } catch (e) {
      await db.update(workspaceFiles).set({ ingestedAt: null }).where(eq(workspaceFiles.id, id))
      throw e
    }

    revalidateTag('operations', 'max') // analytics caches refresh immediately

    return NextResponse.json({
      ingested: { lines: rec.lines.length, invoices: rec.invoices.length, customers: rec.customers.length, products: rec.products.length, skipped: rec.skipped },
    })
  } catch (e) {
    return dbUnavailable(e)
  }
}
