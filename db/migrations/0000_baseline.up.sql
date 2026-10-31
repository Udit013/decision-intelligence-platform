-- 0000 · Baseline: the original single-dataset tables that 0001 transforms.
--
-- Fresh databases (new installs, CI) need these before 0001. Existing databases
-- already have them, so the whole script is skipped when they exist — it is a
-- recorded no-op on production.
DO $baseline$
BEGIN
  IF to_regclass('operations_invoice_lines') IS NOT NULL THEN
    RETURN;
  END IF;

  CREATE TABLE operations_customers (
      customer_id character varying(32) NOT NULL,
      country character varying(100),
      first_seen timestamp without time zone,
      last_seen timestamp without time zone
  );

  CREATE TABLE operations_etl_logs (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      source character varying(255) NOT NULL,
      total_rows integer DEFAULT 0,
      inserted_rows integer DEFAULT 0,
      skipped_rows integer DEFAULT 0,
      notes text,
      created_at timestamp without time zone DEFAULT now()
  );

  CREATE TABLE operations_invoice_lines (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      invoice character varying(32) NOT NULL,
      stock_code character varying(32) NOT NULL,
      quantity integer NOT NULL,
      unit_price real NOT NULL,
      line_revenue real NOT NULL,
      invoice_date timestamp without time zone NOT NULL
  );

  CREATE TABLE operations_invoices (
      invoice character varying(32) NOT NULL,
      invoice_date timestamp without time zone NOT NULL,
      customer_id character varying(32),
      country character varying(100),
      is_return boolean DEFAULT false
  );

  CREATE TABLE operations_products (
      stock_code character varying(32) NOT NULL,
      description text,
      category character varying(100),
      assumed_cost_ratio real
  );

  CREATE TABLE workspace_files (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      name character varying(200) NOT NULL,
      original_filename character varying(255) NOT NULL,
      format character varying(10) NOT NULL,
      size_bytes integer NOT NULL,
      scope character varying(20) DEFAULT 'shared'::character varying NOT NULL,
      status character varying(20) DEFAULT 'ready'::character varying NOT NULL,
      error text,
      columns jsonb,
      row_count integer,
      sample_rows jsonb,
      text_preview text,
      raw_base64 text NOT NULL,
      ingested_at timestamp without time zone,
      created_at timestamp without time zone DEFAULT now() NOT NULL,
      updated_at timestamp without time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE ONLY operations_customers
      ADD CONSTRAINT operations_customers_pkey PRIMARY KEY (customer_id);

  ALTER TABLE ONLY operations_etl_logs
      ADD CONSTRAINT operations_etl_logs_pkey PRIMARY KEY (id);

  ALTER TABLE ONLY operations_invoice_lines
      ADD CONSTRAINT operations_invoice_lines_pkey PRIMARY KEY (id);

  ALTER TABLE ONLY operations_invoices
      ADD CONSTRAINT operations_invoices_pkey PRIMARY KEY (invoice);

  ALTER TABLE ONLY operations_products
      ADD CONSTRAINT operations_products_pkey PRIMARY KEY (stock_code);

  ALTER TABLE ONLY workspace_files
      ADD CONSTRAINT workspace_files_pkey PRIMARY KEY (id);

  CREATE INDEX ops_customers_country_idx ON operations_customers USING btree (country);

  CREATE INDEX ops_invoices_customer_idx ON operations_invoices USING btree (customer_id);

  CREATE INDEX ops_invoices_date_idx ON operations_invoices USING btree (invoice_date);

  CREATE INDEX ops_lines_date_idx ON operations_invoice_lines USING btree (invoice_date);

  CREATE INDEX ops_lines_invoice_idx ON operations_invoice_lines USING btree (invoice);

  CREATE INDEX ops_lines_stock_idx ON operations_invoice_lines USING btree (stock_code);

  CREATE INDEX ops_products_category_idx ON operations_products USING btree (category);

  CREATE INDEX workspace_files_scope_idx ON workspace_files USING btree (scope);
END
$baseline$;
