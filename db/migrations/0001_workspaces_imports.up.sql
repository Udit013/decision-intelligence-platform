-- 0001 · Private workspaces, tracked imports, and real-data tables for all modules.
--
-- Expand-only for existing data: new columns use constant defaults, which
-- Postgres stores as metadata (no rewrite of the ~1M-row lines table). All
-- existing rows land in the read-only demo workspace under one legacy import.
-- Runs inside a single transaction (see scripts/db-migrate.ts).

-- Refuse to drop the legacy demo tables unless they are still empty.
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_roadmap_items','product_initiatives','product_opportunities',
    'product_experiment_results','product_experiments','product_events','product_users',
    'product_features','product_goals','market_scenarios','market_opportunities',
    'market_competitive','market_markets'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
      IF n > 0 THEN RAISE EXCEPTION 'legacy table % has % rows; refusing to drop', t, n; END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS product_roadmap_items, product_initiatives, product_opportunities,
  product_experiment_results, product_experiments, product_events, product_users,
  product_features, product_goals, market_scenarios, market_opportunities,
  market_competitive, market_markets;

-- ── Import ledger ────────────────────────────────────────────────────────────
CREATE TABLE data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  domain varchar(20) NOT NULL CHECK (domain IN ('operations','market','product')),
  kind varchar(40) NOT NULL,
  file_id uuid REFERENCES workspace_files(id) ON DELETE SET NULL,
  label varchar(255) NOT NULL,
  content_hash char(64),
  status varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed','undone')),
  rows_total integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_duplicate integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  column_mapping jsonb,
  issues jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  undone_at timestamptz
);
CREATE INDEX data_imports_ws_idx ON data_imports (workspace_id, created_at DESC);
-- One live import per identical file content and kind: re-importing the same
-- bytes is rejected, and concurrent commits of the same file cannot both win.
CREATE UNIQUE INDEX data_imports_live_content_uq ON data_imports (workspace_id, kind, content_hash)
  WHERE status IN ('pending','committed') AND content_hash IS NOT NULL;

INSERT INTO data_imports (id, workspace_id, domain, kind, label, status, rows_total, rows_inserted, committed_at)
SELECT '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000000',
       'operations', 'operations.order_lines', 'UCI Online Retail II — sample dataset (CLI ETL)',
       'committed', count(*), count(*), now()
FROM operations_invoice_lines;

-- ── Workspace files ──────────────────────────────────────────────────────────
ALTER TABLE workspace_files
  ADD COLUMN workspace_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000',
  ADD COLUMN content_hash char(64);
ALTER TABLE workspace_files ALTER COLUMN workspace_id DROP DEFAULT;
CREATE INDEX workspace_files_ws_idx ON workspace_files (workspace_id, created_at DESC);

-- ── Operations: scope every table to a workspace ─────────────────────────────
ALTER TABLE operations_customers ADD COLUMN workspace_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';
ALTER TABLE operations_customers ALTER COLUMN workspace_id DROP DEFAULT;
ALTER TABLE operations_customers DROP CONSTRAINT operations_customers_pkey;
ALTER TABLE operations_customers ADD CONSTRAINT operations_customers_pkey PRIMARY KEY (workspace_id, customer_id);

ALTER TABLE operations_products ADD COLUMN workspace_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';
ALTER TABLE operations_products ALTER COLUMN workspace_id DROP DEFAULT;
ALTER TABLE operations_products DROP CONSTRAINT operations_products_pkey;
ALTER TABLE operations_products ADD CONSTRAINT operations_products_pkey PRIMARY KEY (workspace_id, stock_code);

ALTER TABLE operations_invoices ADD COLUMN workspace_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';
ALTER TABLE operations_invoices ALTER COLUMN workspace_id DROP DEFAULT;
ALTER TABLE operations_invoices DROP CONSTRAINT operations_invoices_pkey;
ALTER TABLE operations_invoices ADD CONSTRAINT operations_invoices_pkey PRIMARY KEY (workspace_id, invoice);
DROP INDEX ops_invoices_customer_idx;
DROP INDEX ops_invoices_date_idx;
CREATE INDEX ops_invoices_customer_idx ON operations_invoices (workspace_id, customer_id);

ALTER TABLE operations_invoice_lines
  ADD COLUMN workspace_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000',
  ADD COLUMN import_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  ADD COLUMN row_key text;
ALTER TABLE operations_invoice_lines ALTER COLUMN workspace_id DROP DEFAULT, ALTER COLUMN import_id DROP DEFAULT;
ALTER TABLE operations_invoice_lines
  ADD CONSTRAINT operations_invoice_lines_import_fk FOREIGN KEY (import_id) REFERENCES data_imports(id) NOT VALID;
ALTER TABLE operations_invoice_lines VALIDATE CONSTRAINT operations_invoice_lines_import_fk;
DROP INDEX ops_lines_invoice_idx;
DROP INDEX ops_lines_stock_idx;
DROP INDEX ops_lines_date_idx;
CREATE INDEX ops_lines_ws_date_idx ON operations_invoice_lines (workspace_id, invoice_date);
CREATE INDEX ops_lines_ws_invoice_idx ON operations_invoice_lines (workspace_id, invoice);
CREATE INDEX ops_lines_ws_stock_idx ON operations_invoice_lines (workspace_id, stock_code);
CREATE INDEX ops_lines_import_idx ON operations_invoice_lines (import_id);
-- Cross-import de-duplication key (NULL for the legacy CLI-loaded sample).
CREATE UNIQUE INDEX ops_lines_ws_row_key_uq ON operations_invoice_lines (workspace_id, row_key) WHERE row_key IS NOT NULL;

-- ── Market: user-supplied indicators and competitor shares ───────────────────
CREATE TABLE market_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  import_id uuid NOT NULL REFERENCES data_imports(id),
  market_key varchar(120) NOT NULL,
  name varchar(120) NOT NULL,
  code varchar(12),
  region varchar(80),
  gdp_usd_bn double precision CHECK (gdp_usd_bn >= 0),
  gdp_growth_pct double precision CHECK (gdp_growth_pct BETWEEN -100 AND 100),
  population_m double precision CHECK (population_m >= 0),
  avg_income_usd double precision CHECK (avg_income_usd >= 0),
  internet_pct double precision CHECK (internet_pct BETWEEN 0 AND 100),
  mobile_pct double precision CHECK (mobile_pct BETWEEN 0 AND 100),
  urban_pct double precision CHECK (urban_pct BETWEEN 0 AND 100),
  purchasing_power_index double precision CHECK (purchasing_power_index BETWEEN 0 AND 100),
  ease_of_business double precision CHECK (ease_of_business BETWEEN 0 AND 100),
  tax_rate_pct double precision CHECK (tax_rate_pct BETWEEN 0 AND 100),
  inflation_pct double precision CHECK (inflation_pct BETWEEN -50 AND 1000),
  currency_stability double precision CHECK (currency_stability BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_indicators_ws_key_uq UNIQUE (workspace_id, market_key)
);
CREATE INDEX market_indicators_import_idx ON market_indicators (import_id);

CREATE TABLE market_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  import_id uuid NOT NULL REFERENCES data_imports(id),
  market_key varchar(120) NOT NULL,
  competitor varchar(160) NOT NULL,
  market_share_pct double precision NOT NULL CHECK (market_share_pct > 0 AND market_share_pct <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_competitors_ws_key_uq UNIQUE (workspace_id, market_key, competitor)
);
CREATE INDEX market_competitors_import_idx ON market_competitors (import_id);

-- ── Product: event log, experiment results, backlog ──────────────────────────
CREATE TABLE product_tracked_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  import_id uuid NOT NULL REFERENCES data_imports(id),
  user_key varchar(128) NOT NULL,
  event_name varchar(120) NOT NULL,
  occurred_at timestamptz NOT NULL,
  plan varchar(60),
  country varchar(80),
  row_key text NOT NULL,
  CONSTRAINT product_tracked_events_ws_row_uq UNIQUE (workspace_id, row_key)
);
CREATE INDEX product_events_ws_user_idx ON product_tracked_events (workspace_id, user_key, occurred_at);
CREATE INDEX product_events_import_idx ON product_tracked_events (import_id);

CREATE TABLE product_experiment_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  import_id uuid NOT NULL REFERENCES data_imports(id),
  experiment varchar(160) NOT NULL,
  variant varchar(80) NOT NULL,
  users integer NOT NULL CHECK (users > 0),
  conversions integer NOT NULL CHECK (conversions >= 0 AND conversions <= users),
  hypothesis text,
  CONSTRAINT product_experiment_stats_ws_uq UNIQUE (workspace_id, experiment, variant)
);
CREATE INDEX product_experiment_stats_import_idx ON product_experiment_stats (import_id);

CREATE TABLE product_backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  import_id uuid NOT NULL REFERENCES data_imports(id),
  name_key varchar(200) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  reach double precision NOT NULL CHECK (reach >= 0),
  impact double precision NOT NULL CHECK (impact >= 0),
  confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  effort double precision NOT NULL CHECK (effort > 0),
  user_value double precision CHECK (user_value >= 0),
  time_criticality double precision CHECK (time_criticality >= 0),
  risk_reduction double precision CHECK (risk_reduction >= 0),
  CONSTRAINT product_backlog_items_ws_uq UNIQUE (workspace_id, name_key)
);
CREATE INDEX product_backlog_items_import_idx ON product_backlog_items (import_id);
