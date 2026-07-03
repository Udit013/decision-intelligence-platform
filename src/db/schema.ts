/**
 * Single unified Drizzle schema for CoreSight IQ.
 *
 * Tables are namespaced per domain by table-name prefix (`operations_`, `market_`,
 * `product_`) so all three domains share one Postgres database and one migration
 * history, while staying logically separated. No cross-domain foreign keys.
 *
 * Auth is intentionally omitted — the platform ships open (per project decision).
 */
import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core'

/* ════════════════════════════════════════════════════════════════════════════
 *  SHARED DATA WORKSPACE — user-uploaded files, available to every module.
 *  Raw bytes live in Postgres base64-encoded (files are capped at 4MB, under
 *  Vercel's request limit; the neon-http driver ships params as JSON text, so
 *  base64 text beats bytea here). Reprocess/replace/ingest re-read the original
 *  without extra infra. `scope` = 'shared' (default) or a domain id.
 * ════════════════════════════════════════════════════════════════════════════ */

export const workspaceFiles = pgTable(
  'workspace_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Display name (renameable); original filename kept separately. */
    name: varchar('name', { length: 200 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    format: varchar('format', { length: 10 }).notNull(), // csv | xlsx | json | pdf | txt | docx
    sizeBytes: integer('size_bytes').notNull(),
    scope: varchar('scope', { length: 20 }).notNull().default('shared'),
    status: varchar('status', { length: 20 }).notNull().default('ready'), // ready | error
    error: text('error'),
    /** Tabular formats only: detected columns + row count + preview sample. */
    columns: jsonb('columns').$type<string[]>(),
    rowCount: integer('row_count'),
    sampleRows: jsonb('sample_rows').$type<Record<string, unknown>[]>(),
    /** Text formats only: first ~2000 chars for preview. */
    textPreview: text('text_preview'),
    /** Original bytes, base64 — source of truth for preview/reprocess/replace/ingest. */
    rawBase64: text('raw_base64').notNull(),
    /** Set when this file's rows were ingested into the Operations schema. */
    ingestedAt: timestamp('ingested_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('workspace_files_scope_idx').on(t.scope)],
)

/* ════════════════════════════════════════════════════════════════════════════
 *  OPERATIONS domain — shaped for the UCI "Online Retail II" dataset.
 *  Source columns: Invoice, StockCode, Description, Quantity, InvoiceDate,
 *  Price, Customer ID, Country. Normalized into customers / products / invoices /
 *  invoice_lines. Cost & stock are NOT in the source — any margin/inventory
 *  figure is derived from labeled assumptions, never presented as ground truth.
 * ════════════════════════════════════════════════════════════════════════════ */

export const operationsCustomers = pgTable(
  'operations_customers',
  {
    // The dataset's "Customer ID" is the natural key (some rows have none → guest).
    customerId: varchar('customer_id', { length: 32 }).primaryKey(),
    country: varchar('country', { length: 100 }),
    firstSeen: timestamp('first_seen'),
    lastSeen: timestamp('last_seen'),
  },
  (t) => [index('ops_customers_country_idx').on(t.country)],
)

export const operationsProducts = pgTable(
  'operations_products',
  {
    // The dataset's "StockCode" is the natural key.
    stockCode: varchar('stock_code', { length: 32 }).primaryKey(),
    description: text('description'),
    // Derived (not in source): coarse category bucket inferred from description.
    category: varchar('category', { length: 100 }),
    // Derived assumption: category-level cost ratio used for margin estimates.
    assumedCostRatio: real('assumed_cost_ratio'),
  },
  (t) => [index('ops_products_category_idx').on(t.category)],
)

export const operationsInvoices = pgTable(
  'operations_invoices',
  {
    invoice: varchar('invoice', { length: 32 }).primaryKey(),
    invoiceDate: timestamp('invoice_date').notNull(),
    customerId: varchar('customer_id', { length: 32 }),
    country: varchar('country', { length: 100 }),
    // Credit notes (Invoice prefixed "C") are returns/cancellations.
    isReturn: boolean('is_return').default(false),
  },
  (t) => [
    index('ops_invoices_date_idx').on(t.invoiceDate),
    index('ops_invoices_customer_idx').on(t.customerId),
  ],
)

export const operationsInvoiceLines = pgTable(
  'operations_invoice_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoice: varchar('invoice', { length: 32 }).notNull(),
    stockCode: varchar('stock_code', { length: 32 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: real('unit_price').notNull(),
    lineRevenue: real('line_revenue').notNull(), // quantity * unitPrice (negative for returns)
    invoiceDate: timestamp('invoice_date').notNull(), // denormalized for fast time-series scans
  },
  (t) => [
    index('ops_lines_invoice_idx').on(t.invoice),
    index('ops_lines_stock_idx').on(t.stockCode),
    index('ops_lines_date_idx').on(t.invoiceDate),
  ],
)

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
 *  MARKET domain (from geostrategy). Synthetic demo data — labeled in-UI.
 * ════════════════════════════════════════════════════════════════════════════ */

export const marketMarkets = pgTable('market_markets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  type: text('type').notNull(),
  parentId: uuid('parent_id'),
  continent: text('continent'),
  gdp: real('gdp').notNull(),
  gdpGrowth: real('gdp_growth').notNull(),
  gdpPerCapita: real('gdp_per_capita').notNull(),
  population: real('population').notNull(),
  internetPenetration: real('internet_penetration').notNull(),
  mobileAdoption: real('mobile_adoption').notNull(),
  urbanization: real('urbanization').notNull(),
  avgIncome: real('avg_income').notNull(),
  purchasingPowerIndex: real('purchasing_power_index').notNull(),
  easeOfDoingBusiness: real('ease_of_doing_business').notNull(),
  taxRate: real('tax_rate').notNull(),
  inflationRate: real('inflation_rate').notNull(),
  currencyStability: real('currency_stability').notNull(),
  consumerSpending: real('consumer_spending').notNull(),
  industryGrowth: jsonb('industry_growth').notNull().$type<Record<string, number>>(),
  marketAttractivenessScore: real('market_attractiveness_score').notNull(),
  opportunityScore: real('opportunity_score').notNull(),
  riskScore: real('risk_score').notNull(),
  easeOfEntry: real('ease_of_entry').notNull(),
  historicalGdp: jsonb('historical_gdp').notNull().$type<Array<{ year: number; value: number }>>(),
  historicalGrowth: jsonb('historical_growth').notNull().$type<Array<{ year: number; value: number }>>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const marketCompetitive = pgTable('market_competitive', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull(),
  competitorCount: integer('competitor_count').notNull(),
  marketSaturation: real('market_saturation').notNull(),
  marketConcentration: real('market_concentration').notNull(),
  competitiveDensity: real('competitive_density').notNull(),
  topPlayers: jsonb('top_players').notNull().$type<Array<{ name: string; marketShare: number; strength: string }>>(),
  competitivePressureScore: real('competitive_pressure_score').notNull(),
  entryDifficultyScore: real('entry_difficulty_score').notNull(),
  industryBreakdown: jsonb('industry_breakdown').notNull().$type<Array<{ industry: string; playerCount: number; saturation: number }>>(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const marketOpportunities = pgTable('market_opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull(),
  marketName: text('market_name').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  opportunityScore: real('opportunity_score').notNull(),
  marketPotential: real('market_potential').notNull(),
  expectedRevenue: real('expected_revenue').notNull(),
  confidenceScore: real('confidence_score').notNull(),
  timeHorizon: text('time_horizon').notNull(),
  drivers: jsonb('drivers').notNull().$type<string[]>(),
  risks: jsonb('risks').notNull().$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const marketScenarios = pgTable('market_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull(),
  marketName: text('market_name').notNull(),
  strategy: text('strategy').notNull(),
  budget: real('budget').notNull(),
  teamSize: integer('team_size').notNull(),
  productCategory: text('product_category').notNull(),
  pricingStrategy: text('pricing_strategy').notNull(),
  marketingSpend: real('marketing_spend').notNull(),
  results: jsonb('results').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
})

/* ════════════════════════════════════════════════════════════════════════════
 *  PRODUCT domain (from productlab). Synthetic demo data — labeled in-UI.
 * ════════════════════════════════════════════════════════════════════════════ */

export const productUsers = pgTable(
  'product_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    anonymousId: varchar('anonymous_id', { length: 255 }),
    email: varchar('email', { length: 255 }),
    name: varchar('name', { length: 255 }),
    plan: varchar('plan', { length: 50 }).default('free'),
    country: varchar('country', { length: 100 }),
    company: varchar('company', { length: 255 }),
    role: varchar('role', { length: 100 }),
    signupSource: varchar('signup_source', { length: 100 }),
    signedUpAt: timestamp('signed_up_at').defaultNow(),
    lastSeenAt: timestamp('last_seen_at').defaultNow(),
    isActive: boolean('is_active').default(true),
    traits: jsonb('traits').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('product_users_anonymous_id_idx').on(t.anonymousId),
    index('product_users_email_idx').on(t.email),
    index('product_users_signed_up_at_idx').on(t.signedUpAt),
  ],
)

export const productEvents = pgTable(
  'product_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => productUsers.id),
    anonymousId: varchar('anonymous_id', { length: 255 }),
    sessionId: varchar('session_id', { length: 255 }),
    eventName: varchar('event_name', { length: 255 }).notNull(),
    eventCategory: varchar('event_category', { length: 100 }),
    properties: jsonb('properties').$type<Record<string, unknown>>(),
    page: varchar('page', { length: 500 }),
    referrer: varchar('referrer', { length: 500 }),
    deviceType: varchar('device_type', { length: 50 }),
    browser: varchar('browser', { length: 100 }),
    country: varchar('country', { length: 100 }),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
  },
  (t) => [
    index('product_events_user_id_idx').on(t.userId),
    index('product_events_event_name_idx').on(t.eventName),
    index('product_events_received_at_idx').on(t.receivedAt),
    index('product_events_session_id_idx').on(t.sessionId),
  ],
)

export const productFeatures = pgTable('product_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  trackingEvent: varchar('tracking_event', { length: 255 }),
  isCore: boolean('is_core').default(false),
  launchedAt: timestamp('launched_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const productExperiments = pgTable('product_experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  hypothesis: text('hypothesis'),
  status: varchar('status', { length: 50 }).default('draft'),
  type: varchar('type', { length: 50 }).default('ab'),
  variants: jsonb('variants').$type<Array<{ name: string; description: string; trafficPercent: number }>>(),
  primaryMetric: varchar('primary_metric', { length: 255 }),
  secondaryMetrics: jsonb('secondary_metrics').$type<string[]>(),
  targetSegment: varchar('target_segment', { length: 255 }),
  trafficAllocation: real('traffic_allocation').default(100),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const productExperimentResults = pgTable('product_experiment_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  experimentId: uuid('experiment_id').references(() => productExperiments.id).notNull(),
  variant: varchar('variant', { length: 100 }).notNull(),
  metric: varchar('metric', { length: 255 }).notNull(),
  sampleSize: integer('sample_size').default(0),
  conversions: integer('conversions').default(0),
  conversionRate: real('conversion_rate').default(0),
  meanValue: real('mean_value'),
  stdDev: real('std_dev'),
  liftPercent: real('lift_percent'),
  pValue: real('p_value'),
  confidenceInterval: jsonb('confidence_interval').$type<[number, number]>(),
  isSignificant: boolean('is_significant').default(false),
  verdict: varchar('verdict', { length: 50 }),
  calculatedAt: timestamp('calculated_at').defaultNow(),
})

export const productOpportunities = pgTable('product_opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  description: text('description'),
  opportunityScore: real('opportunity_score').default(0),
  userImpact: real('user_impact').default(0),
  businessImpact: real('business_impact').default(0),
  confidenceScore: real('confidence_score').default(0),
  evidence: jsonb('evidence').$type<string[]>(),
  affectedUsers: integer('affected_users').default(0),
  status: varchar('status', { length: 50 }).default('active'),
  discoveredAt: timestamp('discovered_at').defaultNow(),
})

export const productInitiatives = pgTable('product_initiatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  opportunityId: uuid('opportunity_id').references(() => productOpportunities.id),
  status: varchar('status', { length: 50 }).default('backlog'),
  reach: real('reach').default(0),
  impact: real('impact').default(0),
  confidence: real('confidence').default(0),
  effort: real('effort').default(0),
  riceScore: real('rice_score').default(0),
  iceScore: real('ice_score').default(0),
  wsjfScore: real('wsjf_score').default(0),
  priorityScore: real('priority_score').default(0),
  strategicAlignment: real('strategic_alignment').default(0),
  expectedRoi: real('expected_roi').default(0),
  expectedRetentionLift: real('expected_retention_lift').default(0),
  expectedRevenueLift: real('expected_revenue_lift').default(0),
  engineeringCost: integer('engineering_cost').default(0),
  recommendation: text('recommendation'),
  quarter: varchar('quarter', { length: 20 }),
  tags: jsonb('tags').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const productRoadmapItems = pgTable('product_roadmap_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  initiativeId: uuid('initiative_id').references(() => productInitiatives.id),
  name: varchar('name', { length: 255 }).notNull(),
  quarter: varchar('quarter', { length: 20 }).notNull(),
  status: varchar('status', { length: 50 }).default('planned'),
  priority: integer('priority').default(0),
  estimatedWeeks: integer('estimated_weeks').default(2),
  dependencies: jsonb('dependencies').$type<string[]>(),
  expectedOutcome: text('expected_outcome'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const productGoals = pgTable('product_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }),
  targetValue: real('target_value'),
  currentValue: real('current_value'),
  unit: varchar('unit', { length: 50 }),
  quarter: varchar('quarter', { length: 20 }),
  status: varchar('status', { length: 50 }).default('on_track'),
  createdAt: timestamp('created_at').defaultNow(),
})
