/**
 * Single unified Drizzle schema for CoreSight IQ — mirrors db/migrations exactly
 * (schema changes ship as reviewed SQL migrations, not `drizzle-kit push`).
 *
 * Tenancy: every user-data row carries `workspace_id`. Workspaces are anonymous
 * and private (see src/server/workspace.ts); DEMO_WORKSPACE_ID holds the shared,
 * read-only sample data. Every imported fact row carries `import_id`, so an
 * import can be undone exactly.
 */
import {
  pgTable,
  text,
  integer,
  real,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  uuid,
  varchar,
  char,
  index,
  uniqueIndex,
  unique,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/* ════════════════════════════════════════════════════════════════════════════
 *  DATA WORKSPACE — uploaded files (raw bytes base64: the neon-http driver
 *  ships params as JSON text, so base64 text beats bytea; files are ≤ 4 MB).
 * ════════════════════════════════════════════════════════════════════════════ */

export const workspaceFiles = pgTable(
  'workspace_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    format: varchar('format', { length: 10 }).notNull(), // csv | xlsx | json | pdf | txt | docx
    sizeBytes: integer('size_bytes').notNull(),
    scope: varchar('scope', { length: 20 }).notNull().default('shared'),
    status: varchar('status', { length: 20 }).notNull().default('ready'), // ready | error
    error: text('error'),
    columns: jsonb('columns').$type<string[]>(),
    rowCount: integer('row_count'),
    sampleRows: jsonb('sample_rows').$type<Record<string, unknown>[]>(),
    textPreview: text('text_preview'),
    rawBase64: text('raw_base64').notNull(),
    /** sha256 of the raw bytes — identical re-imports are rejected per kind. */
    contentHash: char('content_hash', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('workspace_files_scope_idx').on(t.scope),
    index('workspace_files_ws_idx').on(t.workspaceId, t.createdAt.desc()),
  ],
)

/* ════════════════════════════════════════════════════════════════════════════
 *  IMPORT LEDGER — one row per import; facts reference it for exact undo.
 * ════════════════════════════════════════════════════════════════════════════ */

export const dataImports = pgTable(
  'data_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    domain: varchar('domain', { length: 20 }).notNull(),
    kind: varchar('kind', { length: 40 }).notNull(),
    fileId: uuid('file_id').references(() => workspaceFiles.id, { onDelete: 'set null' }),
    label: varchar('label', { length: 255 }).notNull(),
    contentHash: char('content_hash', { length: 64 }),
    status: varchar('status', { length: 12 }).notNull().default('pending'), // pending | committed | undone
    rowsTotal: integer('rows_total').notNull().default(0),
    rowsInserted: integer('rows_inserted').notNull().default(0),
    rowsDuplicate: integer('rows_duplicate').notNull().default(0),
    rowsSkipped: integer('rows_skipped').notNull().default(0),
    columnMapping: jsonb('column_mapping').$type<Record<string, string>>(),
    issues: jsonb('issues').$type<{ row: number; field: string; message: string }[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
  },
  (t) => [
    index('data_imports_ws_idx').on(t.workspaceId, t.createdAt.desc()),
    uniqueIndex('data_imports_live_content_uq')
      .on(t.workspaceId, t.kind, t.contentHash)
      .where(sql`status IN ('pending','committed') AND content_hash IS NOT NULL`),
    check('data_imports_domain_check', sql`domain IN ('operations','market','product')`),
    check('data_imports_status_check', sql`status IN ('pending','committed','undone')`),
  ],
)

/* ════════════════════════════════════════════════════════════════════════════
 *  OPERATIONS — order lines (UCI Online Retail II shape) normalized into
 *  customers / products / invoices / invoice_lines, scoped per workspace.
 *  Cost & stock are NOT in the source — margins are labeled assumptions.
 * ════════════════════════════════════════════════════════════════════════════ */

export const operationsCustomers = pgTable(
  'operations_customers',
  {
    workspaceId: uuid('workspace_id').notNull(),
    customerId: varchar('customer_id', { length: 32 }).notNull(),
    country: varchar('country', { length: 100 }),
    firstSeen: timestamp('first_seen'),
    lastSeen: timestamp('last_seen'),
  },
  (t) => [
    primaryKey({ name: 'operations_customers_pkey', columns: [t.workspaceId, t.customerId] }),
    index('ops_customers_country_idx').on(t.country),
  ],
)

export const operationsProducts = pgTable(
  'operations_products',
  {
    workspaceId: uuid('workspace_id').notNull(),
    stockCode: varchar('stock_code', { length: 32 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }), // derived from description
    assumedCostRatio: real('assumed_cost_ratio'), // labeled assumption
  },
  (t) => [
    primaryKey({ name: 'operations_products_pkey', columns: [t.workspaceId, t.stockCode] }),
    index('ops_products_category_idx').on(t.category),
  ],
)

export const operationsInvoices = pgTable(
  'operations_invoices',
  {
    workspaceId: uuid('workspace_id').notNull(),
    invoice: varchar('invoice', { length: 32 }).notNull(),
    invoiceDate: timestamp('invoice_date').notNull(),
    customerId: varchar('customer_id', { length: 32 }),
    country: varchar('country', { length: 100 }),
    isReturn: boolean('is_return').default(false), // credit notes ("C…") / negative qty
  },
  (t) => [
    primaryKey({ name: 'operations_invoices_pkey', columns: [t.workspaceId, t.invoice] }),
    index('ops_invoices_customer_idx').on(t.workspaceId, t.customerId),
  ],
)

export const operationsInvoiceLines = pgTable(
  'operations_invoice_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    importId: uuid('import_id').notNull(),
    /** Content key (sha256 of the line + its occurrence index) for cross-import dedup. */
    rowKey: text('row_key'),
    invoice: varchar('invoice', { length: 32 }).notNull(),
    stockCode: varchar('stock_code', { length: 32 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: real('unit_price').notNull(),
    lineRevenue: real('line_revenue').notNull(), // quantity × unitPrice (negative for returns)
    invoiceDate: timestamp('invoice_date').notNull(),
  },
  (t) => [
    index('ops_lines_ws_date_idx').on(t.workspaceId, t.invoiceDate),
    index('ops_lines_ws_invoice_idx').on(t.workspaceId, t.invoice),
    index('ops_lines_ws_stock_idx').on(t.workspaceId, t.stockCode),
    index('ops_lines_import_idx').on(t.importId),
    uniqueIndex('ops_lines_ws_row_key_uq').on(t.workspaceId, t.rowKey).where(sql`row_key IS NOT NULL`),
  ],
)

/** Legacy audit log of CLI bulk loads before the import ledger existed. */
export const operationsEtlLogs = pgTable('operations_etl_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: varchar('source', { length: 255 }).notNull(),
  totalRows: integer('total_rows').default(0),
  insertedRows: integer('inserted_rows').default(0),
  skippedRows: integer('skipped_rows').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
})

/* ════════════════════════════════════════════════════════════════════════════
 *  MARKET — user-supplied market indicators and competitor shares. Every
 *  metric is optional; scores are computed only from what was provided.
 * ════════════════════════════════════════════════════════════════════════════ */

export const marketIndicators = pgTable(
  'market_indicators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    importId: uuid('import_id').notNull().references(() => dataImports.id),
    marketKey: varchar('market_key', { length: 120 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    code: varchar('code', { length: 12 }),
    region: varchar('region', { length: 80 }),
    gdpUsdBn: doublePrecision('gdp_usd_bn'),
    gdpGrowthPct: doublePrecision('gdp_growth_pct'),
    populationM: doublePrecision('population_m'),
    avgIncomeUsd: doublePrecision('avg_income_usd'),
    internetPct: doublePrecision('internet_pct'),
    mobilePct: doublePrecision('mobile_pct'),
    urbanPct: doublePrecision('urban_pct'),
    purchasingPowerIndex: doublePrecision('purchasing_power_index'),
    easeOfBusiness: doublePrecision('ease_of_business'),
    taxRatePct: doublePrecision('tax_rate_pct'),
    inflationPct: doublePrecision('inflation_pct'),
    currencyStability: doublePrecision('currency_stability'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('market_indicators_ws_key_uq').on(t.workspaceId, t.marketKey),
    index('market_indicators_import_idx').on(t.importId),
  ],
)

export const marketCompetitors = pgTable(
  'market_competitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    importId: uuid('import_id').notNull().references(() => dataImports.id),
    marketKey: varchar('market_key', { length: 120 }).notNull(),
    competitor: varchar('competitor', { length: 160 }).notNull(),
    marketSharePct: doublePrecision('market_share_pct').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('market_competitors_ws_key_uq').on(t.workspaceId, t.marketKey, t.competitor),
    index('market_competitors_import_idx').on(t.importId),
  ],
)

/* ════════════════════════════════════════════════════════════════════════════
 *  PRODUCT — raw event log, aggregated experiment results, and a backlog.
 * ════════════════════════════════════════════════════════════════════════════ */

export const productTrackedEvents = pgTable(
  'product_tracked_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    importId: uuid('import_id').notNull().references(() => dataImports.id),
    userKey: varchar('user_key', { length: 128 }).notNull(),
    eventName: varchar('event_name', { length: 120 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    plan: varchar('plan', { length: 60 }),
    country: varchar('country', { length: 80 }),
    rowKey: text('row_key').notNull(),
  },
  (t) => [
    unique('product_tracked_events_ws_row_uq').on(t.workspaceId, t.rowKey),
    index('product_events_ws_user_idx').on(t.workspaceId, t.userKey, t.occurredAt),
    index('product_events_import_idx').on(t.importId),
  ],
)

export const productExperimentStats = pgTable(
  'product_experiment_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    importId: uuid('import_id').notNull().references(() => dataImports.id),
    experiment: varchar('experiment', { length: 160 }).notNull(),
    variant: varchar('variant', { length: 80 }).notNull(),
    users: integer('users').notNull(),
    conversions: integer('conversions').notNull(),
    hypothesis: text('hypothesis'),
  },
  (t) => [
    unique('product_experiment_stats_ws_uq').on(t.workspaceId, t.experiment, t.variant),
    index('product_experiment_stats_import_idx').on(t.importId),
  ],
)

export const productBacklogItems = pgTable(
  'product_backlog_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    importId: uuid('import_id').notNull().references(() => dataImports.id),
    nameKey: varchar('name_key', { length: 200 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    reach: doublePrecision('reach').notNull(),
    impact: doublePrecision('impact').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    effort: doublePrecision('effort').notNull(),
    userValue: doublePrecision('user_value'),
    timeCriticality: doublePrecision('time_criticality'),
    riskReduction: doublePrecision('risk_reduction'),
  },
  (t) => [
    unique('product_backlog_items_ws_uq').on(t.workspaceId, t.nameKey),
    index('product_backlog_items_import_idx').on(t.importId),
  ],
)
