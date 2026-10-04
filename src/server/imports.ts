import 'server-only'
/**
 * Import service: preview (dry run) → commit → undo, for every import kind.
 *
 * Guarantees
 *  • Isolation   — every row is written with the caller's workspace id; undo and
 *                  previews only ever touch that workspace.
 *  • Atomicity   — all fact rows plus the ledger's "committed" flip run in one
 *                  transaction (`atomic`); a failure leaves nothing behind.
 *  • Idempotence — identical file content can't be imported twice per kind (a
 *                  partial unique index on the ledger); overlapping rows across
 *                  different files are skipped by per-table unique keys.
 *  • Exact undo  — fact rows carry import_id; undo deletes exactly those rows,
 *                  then removes Operations dimension rows nothing references.
 */
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { atomic, getDb, type Db } from '@/db'
import {
  dataImports,
  marketCompetitors,
  marketIndicators,
  operationsCustomers,
  operationsInvoiceLines,
  operationsInvoices,
  operationsProducts,
  productBacklogItems,
  productExperimentStats,
  productTrackedEvents,
  workspaceFiles,
} from '@/db/schema'
import { DEMO_WORKSPACE_ID } from '@/db/ids'
import {
  autoMap,
  mappingProblems,
  naturalKey,
  sanitizeMapping,
  validateRows,
  type ColumnMapping,
  type ImportIssue,
  type ImportKindSpec,
  type ParsedRecord,
} from '@/core/imports'
import { occurrenceKeys } from '@/core/imports/keys'
import { GLOBAL_IMPORTED_ROW_CAP, IMPORT_ROW_LIMIT, WORKSPACE_ROW_CAPS, rowCapError } from '@/core/imports/limits'
import { parseBuffer, isTabular, type FileFormat } from '@/core/workspace'
import { getImportKind } from '@/domains/import-kinds'
import { buildOrderRecords } from '@/domains/operations/ingest'

const CHUNK = 1000
const STALE_PENDING_MS = 15 * 60 * 1000

export class ImportError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK))
  return out
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? ''))
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

/* ── Per-kind writers ─────────────────────────────────────────────────────── */

interface Plan {
  /** Rows that will be offered to the database (after in-file de-dup). */
  rows: number
  inFileDuplicates: number
  /** Content/natural keys, for the duplicate estimate in previews. */
  keys: string[]
  /** Key-existence count query against already-imported data. */
  countExisting: (db: Db, workspaceId: string) => Promise<number>
  inserts: (q: Db, workspaceId: string, importId: string) => BatchItem<'pg'>[]
  /** SQL counting rows this import actually inserted (runs inside the transaction). */
  insertedCount: (importId: string) => ReturnType<typeof sql>
  summary: Record<string, string | number>
}

/** First-wins de-dup on a natural key; returns kept records and the duplicate count. */
function dedupeBy(records: ParsedRecord[], key: (r: ParsedRecord) => string) {
  const seen = new Set<string>()
  const kept: { rec: ParsedRecord; key: string }[] = []
  for (const r of records) {
    const k = key(r)
    if (seen.has(k)) continue
    seen.add(k)
    kept.push({ rec: r, key: k })
  }
  return { kept, duplicates: records.length - kept.length }
}

async function countIn(db: Db, table: string, workspaceId: string, column: string, keys: string[]) {
  if (!keys.length) return 0
  let n = 0
  for (const part of chunks(keys)) {
    const res = await db.execute(
      // Drizzle expands an array into ($1, $2, …), which is exactly what IN expects.
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE workspace_id = ${workspaceId} AND ${sql.identifier(column)} IN ${part}`,
    )
    n += Number((res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0)
  }
  return n
}

function dateRange(records: ParsedRecord[], field: string) {
  let min = Infinity
  let max = -Infinity
  for (const r of records) {
    const t = (r[field] as Date).getTime()
    if (t < min) min = t
    if (t > max) max = t
  }
  return records.length ? `${new Date(min).toISOString().slice(0, 10)} → ${new Date(max).toISOString().slice(0, 10)}` : '—'
}

function planFor(kind: ImportKindSpec, records: ParsedRecord[]): Plan {
  switch (kind.id) {
    case 'operations.order_lines': {
      const keys = occurrenceKeys(records.map((r) => [str(r.invoice), str(r.stockCode), str(r.quantity), str(r.unitPrice), iso(r.invoiceDate)]))
      const rec = buildOrderRecords(records)
      return {
        rows: rec.lines.length,
        inFileDuplicates: 0,
        keys,
        countExisting: (db, ws) => countIn(db, 'operations_invoice_lines', ws, 'row_key', keys),
        inserts: (q, ws, importId) => [
          ...chunks(rec.products).map((b) => q.insert(operationsProducts).values(b.map((p) => ({ ...p, workspaceId: ws }))).onConflictDoNothing()),
          ...chunks(rec.customers).map((b) => q.insert(operationsCustomers).values(b.map((c) => ({ ...c, workspaceId: ws }))).onConflictDoNothing()),
          ...chunks(rec.invoices).map((b) => q.insert(operationsInvoices).values(b.map((i) => ({ ...i, workspaceId: ws }))).onConflictDoNothing()),
          ...chunks(rec.lines.map((l, i) => ({ ...l, rowKey: keys[i] }))).map((b) =>
            q.insert(operationsInvoiceLines).values(b.map((l) => ({ ...l, workspaceId: ws, importId }))).onConflictDoNothing(),
          ),
        ],
        insertedCount: (id) => sql`(SELECT count(*) FROM operations_invoice_lines WHERE import_id = ${id})`,
        summary: {
          'Date range': dateRange(records, 'invoiceDate'),
          Orders: rec.invoices.length,
          Products: rec.products.length,
          Customers: rec.customers.length,
        },
      }
    }
    case 'market.markets': {
      const { kept, duplicates } = dedupeBy(records, (r) => naturalKey(str(r.name)))
      const keys = kept.map((k) => k.key)
      return {
        rows: kept.length,
        inFileDuplicates: duplicates,
        keys,
        countExisting: (db, ws) => countIn(db, 'market_indicators', ws, 'market_key', keys),
        inserts: (q, ws, importId) =>
          chunks(kept).map((b) =>
            q
              .insert(marketIndicators)
              .values(
                b.map(({ rec: r, key }) => ({
                  workspaceId: ws,
                  importId,
                  marketKey: key,
                  name: str(r.name),
                  code: (r.code as string | null) ?? null,
                  region: (r.region as string | null) ?? null,
                  gdpUsdBn: r.gdpUsdBn as number | null,
                  gdpGrowthPct: r.gdpGrowthPct as number | null,
                  populationM: r.populationM as number | null,
                  avgIncomeUsd: r.avgIncomeUsd as number | null,
                  internetPct: r.internetPct as number | null,
                  mobilePct: r.mobilePct as number | null,
                  urbanPct: r.urbanPct as number | null,
                  purchasingPowerIndex: r.purchasingPowerIndex as number | null,
                  easeOfBusiness: r.easeOfBusiness as number | null,
                  taxRatePct: r.taxRatePct as number | null,
                  inflationPct: r.inflationPct as number | null,
                  currencyStability: r.currencyStability as number | null,
                })),
              )
              .onConflictDoNothing(),
          ),
        insertedCount: (id) => sql`(SELECT count(*) FROM market_indicators WHERE import_id = ${id})`,
        summary: { Markets: kept.length },
      }
    }
    case 'market.competitors': {
      // Same identity as the table's unique key: (normalized market, competitor name).
      const { kept, duplicates } = dedupeBy(records, (r) => `${naturalKey(str(r.market))}\u001f${str(r.competitor)}`)
      const keys = kept.map((k) => k.key)
      return {
        rows: kept.length,
        inFileDuplicates: duplicates,
        keys,
        countExisting: async (db, ws) => {
          let n = 0
          for (const part of chunks(kept)) {
            const pairs = sql.join(part.map((k) => sql`(${naturalKey(str(k.rec.market))}, ${str(k.rec.competitor)})`), sql`, `)
            const res = await db.execute(sql`
              SELECT count(*)::int AS n FROM market_competitors c
              WHERE c.workspace_id = ${ws} AND (c.market_key, c.competitor) IN (${pairs})`)
            n += Number((res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0)
          }
          return n
        },
        inserts: (q, ws, importId) =>
          chunks(kept).map((b) =>
            q
              .insert(marketCompetitors)
              .values(b.map(({ rec: r }) => ({ workspaceId: ws, importId, marketKey: naturalKey(str(r.market)), competitor: str(r.competitor), marketSharePct: r.sharePct as number })))
              .onConflictDoNothing(),
          ),
        insertedCount: (id) => sql`(SELECT count(*) FROM market_competitors WHERE import_id = ${id})`,
        summary: { Markets: new Set(kept.map((k) => naturalKey(str(k.rec.market)))).size, Competitors: new Set(kept.map((k) => str(k.rec.competitor))).size },
      }
    }
    case 'product.events': {
      const keys = occurrenceKeys(records.map((r) => [str(r.userId), str(r.event), iso(r.timestamp)]))
      return {
        rows: records.length,
        inFileDuplicates: 0,
        keys,
        countExisting: (db, ws) => countIn(db, 'product_tracked_events', ws, 'row_key', keys),
        inserts: (q, ws, importId) =>
          chunks(records.map((r, i) => ({ r, key: keys[i] }))).map((b) =>
            q
              .insert(productTrackedEvents)
              .values(
                b.map(({ r, key }) => ({
                  workspaceId: ws,
                  importId,
                  userKey: str(r.userId),
                  eventName: str(r.event),
                  occurredAt: r.timestamp as Date,
                  plan: (r.plan as string | null) ?? null,
                  country: (r.country as string | null) ?? null,
                  rowKey: key,
                })),
              )
              .onConflictDoNothing(),
          ),
        insertedCount: (id) => sql`(SELECT count(*) FROM product_tracked_events WHERE import_id = ${id})`,
        summary: {
          'Date range': dateRange(records, 'timestamp'),
          Users: new Set(records.map((r) => str(r.userId))).size,
          'Distinct events': new Set(records.map((r) => str(r.event))).size,
        },
      }
    }
    case 'product.experiments': {
      const bad = records.find((r) => (r.conversions as number) > (r.users as number))
      if (bad) throw new ImportError(`"${str(bad.experiment)}" / "${str(bad.variant)}" has more conversions than users.`)
      const { kept, duplicates } = dedupeBy(records, (r) => `${str(r.experiment)}\u001f${str(r.variant)}`)
      return {
        rows: kept.length,
        inFileDuplicates: duplicates,
        keys: kept.map((k) => k.key),
        countExisting: async () => 0,
        inserts: (q, ws, importId) =>
          chunks(kept).map((b) =>
            q
              .insert(productExperimentStats)
              .values(
                b.map(({ rec: r }) => ({
                  workspaceId: ws,
                  importId,
                  experiment: str(r.experiment),
                  variant: str(r.variant),
                  users: r.users as number,
                  conversions: r.conversions as number,
                  hypothesis: (r.hypothesis as string | null) ?? null,
                })),
              )
              .onConflictDoNothing(),
          ),
        insertedCount: (id) => sql`(SELECT count(*) FROM product_experiment_stats WHERE import_id = ${id})`,
        summary: { Experiments: new Set(kept.map((k) => str(k.rec.experiment))).size, Variants: kept.length },
      }
    }
    case 'product.backlog': {
      const { kept, duplicates } = dedupeBy(records, (r) => naturalKey(str(r.name)))
      return {
        rows: kept.length,
        inFileDuplicates: duplicates,
        keys: kept.map((k) => k.key),
        countExisting: (db, ws) => countIn(db, 'product_backlog_items', ws, 'name_key', kept.map((k) => k.key)),
        inserts: (q, ws, importId) =>
          chunks(kept).map((b) =>
            q
              .insert(productBacklogItems)
              .values(
                b.map(({ rec: r, key }) => {
                  const c = r.confidence as number
                  return {
                    workspaceId: ws,
                    importId,
                    nameKey: key,
                    name: str(r.name),
                    description: (r.description as string | null) ?? null,
                    reach: r.reach as number,
                    impact: r.impact as number,
                    // Accept 0–1 or 0–100 %.
                    confidence: c > 1 ? c / 100 : c,
                    effort: r.effort as number,
                    userValue: r.userValue as number | null,
                    timeCriticality: r.timeCriticality as number | null,
                    riskReduction: r.riskReduction as number | null,
                  }
                }),
              )
              .onConflictDoNothing(),
          ),
        insertedCount: (id) => sql`(SELECT count(*) FROM product_backlog_items WHERE import_id = ${id})`,
        summary: {
          Initiatives: kept.length,
          'WSJF inputs': kept.every((k) => k.rec.userValue !== null && k.rec.timeCriticality !== null && k.rec.riskReduction !== null) ? 'complete' : 'partial',
        },
      }
    }
    default:
      throw new ImportError(`Unknown import type "${kind.id}".`)
  }
}

/* ── Preview & commit ─────────────────────────────────────────────────────── */

export interface ImportPreview {
  kind: string
  columns: string[]
  mapping: ColumnMapping
  problems: string[]
  rowsTotal: number
  valid: number
  skipped: number
  issues: ImportIssue[]
  issueCount: number
  inFileDuplicates: number
  existingDuplicates: number
  /** Rows that would actually be inserted. */
  toInsert: number
  summary: Record<string, string | number>
  sample: Record<string, string | number | null>[]
}

async function loadFile(workspaceId: string, fileId: string) {
  const [file] = await getDb()
    .select()
    .from(workspaceFiles)
    .where(and(eq(workspaceFiles.id, fileId), eq(workspaceFiles.workspaceId, workspaceId)))
  if (!file) throw new ImportError('File not found.', 404)
  if (!isTabular(file.format as FileFormat)) throw new ImportError(`${file.format.toUpperCase()} files can't be imported — only CSV, XLSX, or JSON.`)
  if (file.status !== 'ready') throw new ImportError(`This file failed to parse (${file.error ?? 'unknown error'}). Replace or reprocess it first.`)
  const parsed = parseBuffer(file.format as FileFormat, new Uint8Array(Buffer.from(file.rawBase64, 'base64')))
  if (!parsed.table) throw new ImportError(parsed.error ?? 'File could not be parsed.')
  if (parsed.table.rowCount > IMPORT_ROW_LIMIT) {
    throw new ImportError(`File has ${parsed.table.rowCount.toLocaleString('en-US')} rows; one import takes up to ${IMPORT_ROW_LIMIT.toLocaleString('en-US')}. Split the file and import the parts.`)
  }
  return { file, table: parsed.table }
}

async function prepare(workspaceId: string, fileId: string, kindId: string, rawMapping: unknown) {
  const kind = getImportKind(kindId)
  if (!kind) throw new ImportError('Unknown import type.')
  const { file, table } = await loadFile(workspaceId, fileId)
  const mapping = rawMapping ? sanitizeMapping(rawMapping, table.columns, kind.fields) : autoMap(table.columns, kind.fields)
  const problems = mappingProblems(mapping, kind)
  const validation = validateRows(table.rows, kind, mapping)
  return { kind, file, table, mapping, problems, validation }
}

const display = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : (v as string | number | null))

export async function previewImport(workspaceId: string, fileId: string, kindId: string, rawMapping?: unknown): Promise<ImportPreview> {
  const { kind, table, mapping, problems, validation } = await prepare(workspaceId, fileId, kindId, rawMapping)
  const base = {
    kind: kind.id,
    columns: table.columns,
    mapping,
    problems,
    rowsTotal: table.rowCount,
    valid: validation.records.length,
    skipped: validation.skipped,
    issues: validation.issues,
    issueCount: validation.issueCount,
    sample: validation.records.slice(0, 5).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, display(v)]))),
  }
  if (problems.length || !validation.records.length) {
    return { ...base, inFileDuplicates: 0, existingDuplicates: 0, toInsert: 0, summary: {} }
  }
  const plan = planFor(kind, validation.records)
  const existingDuplicates = await plan.countExisting(getDb(), workspaceId)
  return {
    ...base,
    inFileDuplicates: plan.inFileDuplicates,
    existingDuplicates,
    toInsert: Math.max(0, plan.rows - existingDuplicates),
    summary: plan.summary,
  }
}

async function liveRowsByKind(workspaceId: string, kindId: string) {
  const [r] = await getDb()
    .select({ n: sql<number>`coalesce(sum(${dataImports.rowsInserted}), 0)::int` })
    .from(dataImports)
    .where(and(eq(dataImports.workspaceId, workspaceId), eq(dataImports.kind, kindId), eq(dataImports.status, 'committed')))
  return Number(r?.n ?? 0)
}

async function globalImportedRows() {
  const [r] = await getDb()
    .select({ n: sql<number>`coalesce(sum(${dataImports.rowsInserted}), 0)::bigint` })
    .from(dataImports)
    .where(and(ne(dataImports.workspaceId, DEMO_WORKSPACE_ID), eq(dataImports.status, 'committed')))
  return Number(r?.n ?? 0)
}

export interface CommitResult {
  importId: string
  domain: string
  inserted: number
  duplicates: number
  skipped: number
}

export async function commitImport(workspaceId: string, fileId: string, kindId: string, rawMapping?: unknown): Promise<CommitResult> {
  if (workspaceId === DEMO_WORKSPACE_ID) throw new ImportError('The demo workspace is read-only.', 403)
  const { kind, file, mapping, problems, validation } = await prepare(workspaceId, fileId, kindId, rawMapping)
  if (problems.length) throw new ImportError(problems.join(' '))
  if (!validation.records.length) throw new ImportError(`No valid rows to import (${validation.skipped} skipped). Check the issues in the preview.`)
  const plan = planFor(kind, validation.records)

  const capErr = rowCapError(kind.label, await liveRowsByKind(workspaceId, kind.id), plan.rows, WORKSPACE_ROW_CAPS[kind.id] ?? 0)
  if (capErr) throw new ImportError(capErr, 413)
  if ((await globalImportedRows()) + plan.rows > GLOBAL_IMPORTED_ROW_CAP) {
    throw new ImportError('This deployment has reached its storage limit for imported data. Try again later.', 507)
  }

  const db = getDb()
  const contentHash = file.contentHash
  const ledgerRow = {
    workspaceId,
    domain: kind.domain,
    kind: kind.id,
    fileId: file.id,
    label: `${file.name} (${file.originalFilename})`,
    contentHash,
    status: 'pending' as const,
    rowsTotal: validation.records.length + validation.skipped,
    rowsSkipped: validation.skipped,
    columnMapping: mapping,
    issues: validation.issues,
  }

  // Claim: the partial unique index admits one live import per (workspace, kind, content).
  let [claim] = await db.insert(dataImports).values(ledgerRow).onConflictDoNothing().returning({ id: dataImports.id })
  if (!claim && contentHash) {
    // A crashed request can leave a stale 'pending' claim; clear it once and retry.
    await db
      .delete(dataImports)
      .where(
        and(
          eq(dataImports.workspaceId, workspaceId),
          eq(dataImports.kind, kind.id),
          eq(dataImports.contentHash, contentHash),
          eq(dataImports.status, 'pending'),
          lt(dataImports.createdAt, new Date(Date.now() - STALE_PENDING_MS)),
        ),
      )
    ;[claim] = await db.insert(dataImports).values(ledgerRow).onConflictDoNothing().returning({ id: dataImports.id })
  }
  if (!claim) throw new ImportError('This file has already been imported as this data type (or is importing right now). Undo that import first to load it again.', 409)

  const importId = claim.id
  try {
    await atomic((q) => [
      ...plan.inserts(q, workspaceId, importId),
      q
        .update(dataImports)
        .set({
          status: 'committed',
          committedAt: new Date(),
          rowsInserted: sql`${plan.insertedCount(importId)}`,
          rowsDuplicate: sql`${plan.rows + plan.inFileDuplicates} - ${plan.insertedCount(importId)}`,
        })
        .where(eq(dataImports.id, importId)),
    ])
  } catch (e) {
    await db.delete(dataImports).where(and(eq(dataImports.id, importId), eq(dataImports.status, 'pending')))
    throw e
  }

  const [done] = await db
    .select({ inserted: dataImports.rowsInserted, duplicates: dataImports.rowsDuplicate, skipped: dataImports.rowsSkipped })
    .from(dataImports)
    .where(eq(dataImports.id, importId))
  return { importId, domain: kind.domain, inserted: done.inserted, duplicates: done.duplicates, skipped: done.skipped }
}

/* ── Undo ─────────────────────────────────────────────────────────────────── */

function undoStatements(q: Db, kindId: string, workspaceId: string, importId: string): BatchItem<'pg'>[] {
  switch (kindId) {
    case 'operations.order_lines':
      return [
        q.delete(operationsInvoiceLines).where(and(eq(operationsInvoiceLines.workspaceId, workspaceId), eq(operationsInvoiceLines.importId, importId))),
        // Dimension rows are shared between imports; drop only the ones now unreferenced.
        q.execute(sql`DELETE FROM operations_invoices i WHERE i.workspace_id = ${workspaceId}
          AND NOT EXISTS (SELECT 1 FROM operations_invoice_lines l WHERE l.workspace_id = i.workspace_id AND l.invoice = i.invoice)`),
        q.execute(sql`DELETE FROM operations_products p WHERE p.workspace_id = ${workspaceId}
          AND NOT EXISTS (SELECT 1 FROM operations_invoice_lines l WHERE l.workspace_id = p.workspace_id AND l.stock_code = p.stock_code)`),
        q.execute(sql`DELETE FROM operations_customers c WHERE c.workspace_id = ${workspaceId}
          AND NOT EXISTS (SELECT 1 FROM operations_invoices i WHERE i.workspace_id = c.workspace_id AND i.customer_id = c.customer_id)`),
      ]
    case 'market.markets':
      return [q.delete(marketIndicators).where(and(eq(marketIndicators.workspaceId, workspaceId), eq(marketIndicators.importId, importId)))]
    case 'market.competitors':
      return [q.delete(marketCompetitors).where(and(eq(marketCompetitors.workspaceId, workspaceId), eq(marketCompetitors.importId, importId)))]
    case 'product.events':
      return [q.delete(productTrackedEvents).where(and(eq(productTrackedEvents.workspaceId, workspaceId), eq(productTrackedEvents.importId, importId)))]
    case 'product.experiments':
      return [q.delete(productExperimentStats).where(and(eq(productExperimentStats.workspaceId, workspaceId), eq(productExperimentStats.importId, importId)))]
    case 'product.backlog':
      return [q.delete(productBacklogItems).where(and(eq(productBacklogItems.workspaceId, workspaceId), eq(productBacklogItems.importId, importId)))]
    default:
      throw new ImportError(`Unknown import type "${kindId}".`)
  }
}

export async function undoImport(workspaceId: string, importId: string): Promise<{ domain: string; removed: number }> {
  if (workspaceId === DEMO_WORKSPACE_ID) throw new ImportError('The demo workspace is read-only.', 403)
  const [imp] = await getDb()
    .select()
    .from(dataImports)
    .where(and(eq(dataImports.id, importId), eq(dataImports.workspaceId, workspaceId)))
  if (!imp) throw new ImportError('Import not found.', 404)
  if (imp.status !== 'committed') throw new ImportError('This import has already been undone.', 409)

  await atomic((q) => [
    ...undoStatements(q, imp.kind, workspaceId, importId),
    q
      .update(dataImports)
      .set({ status: 'undone', undoneAt: new Date() })
      .where(and(eq(dataImports.id, importId), eq(dataImports.status, 'committed'))),
  ])
  return { domain: imp.domain, removed: imp.rowsInserted }
}

export async function listImports(workspaceId: string) {
  return getDb()
    .select({
      id: dataImports.id,
      domain: dataImports.domain,
      kind: dataImports.kind,
      label: dataImports.label,
      status: dataImports.status,
      rowsTotal: dataImports.rowsTotal,
      rowsInserted: dataImports.rowsInserted,
      rowsDuplicate: dataImports.rowsDuplicate,
      rowsSkipped: dataImports.rowsSkipped,
      createdAt: dataImports.createdAt,
      committedAt: dataImports.committedAt,
      undoneAt: dataImports.undoneAt,
      fileId: dataImports.fileId,
    })
    .from(dataImports)
    .where(and(eq(dataImports.workspaceId, workspaceId), inArray(dataImports.status, ['committed', 'undone'])))
    .orderBy(sql`${dataImports.createdAt} DESC`)
    .limit(200)
}

/** Permanently removes every file, import and row in a workspace. */
export async function deleteWorkspaceData(workspaceId: string) {
  if (workspaceId === DEMO_WORKSPACE_ID) throw new ImportError('The demo workspace is read-only.', 403)
  await atomic((q) => [
    q.delete(operationsInvoiceLines).where(eq(operationsInvoiceLines.workspaceId, workspaceId)),
    q.delete(operationsInvoices).where(eq(operationsInvoices.workspaceId, workspaceId)),
    q.delete(operationsCustomers).where(eq(operationsCustomers.workspaceId, workspaceId)),
    q.delete(operationsProducts).where(eq(operationsProducts.workspaceId, workspaceId)),
    q.delete(marketIndicators).where(eq(marketIndicators.workspaceId, workspaceId)),
    q.delete(marketCompetitors).where(eq(marketCompetitors.workspaceId, workspaceId)),
    q.delete(productTrackedEvents).where(eq(productTrackedEvents.workspaceId, workspaceId)),
    q.delete(productExperimentStats).where(eq(productExperimentStats.workspaceId, workspaceId)),
    q.delete(productBacklogItems).where(eq(productBacklogItems.workspaceId, workspaceId)),
    q.delete(dataImports).where(eq(dataImports.workspaceId, workspaceId)),
    q.delete(workspaceFiles).where(eq(workspaceFiles.workspaceId, workspaceId)),
  ])
}
