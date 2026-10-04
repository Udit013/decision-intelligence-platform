-- 0001 (down) · Return to the single shared-dataset schema.
--
-- WARNING: user-workspace data cannot be represented in the old schema (natural
-- keys were global). This deletes every non-demo row, then restores the original
-- keys, indexes, and the legacy (empty) market_/product_ tables. Take a backup
-- first if workspace data matters (scripts/db-migrate.ts prints a reminder).

DELETE FROM operations_invoice_lines WHERE workspace_id <> '00000000-0000-4000-8000-000000000000';
DELETE FROM operations_invoices      WHERE workspace_id <> '00000000-0000-4000-8000-000000000000';
DELETE FROM operations_customers     WHERE workspace_id <> '00000000-0000-4000-8000-000000000000';
DELETE FROM operations_products      WHERE workspace_id <> '00000000-0000-4000-8000-000000000000';
DELETE FROM workspace_files          WHERE workspace_id <> '00000000-0000-4000-8000-000000000000';

DROP TABLE product_backlog_items, product_experiment_stats, product_tracked_events,
  market_competitors, market_indicators;

-- Operations lines
DROP INDEX ops_lines_ws_row_key_uq, ops_lines_import_idx, ops_lines_ws_stock_idx,
  ops_lines_ws_invoice_idx, ops_lines_ws_date_idx;
ALTER TABLE operations_invoice_lines DROP CONSTRAINT operations_invoice_lines_import_fk;
ALTER TABLE operations_invoice_lines DROP COLUMN row_key, DROP COLUMN import_id, DROP COLUMN workspace_id;
CREATE INDEX ops_lines_invoice_idx ON operations_invoice_lines (invoice);
CREATE INDEX ops_lines_stock_idx ON operations_invoice_lines (stock_code);
CREATE INDEX ops_lines_date_idx ON operations_invoice_lines (invoice_date);

-- Operations dimensions
DROP INDEX ops_invoices_customer_idx;
ALTER TABLE operations_invoices DROP CONSTRAINT operations_invoices_pkey;
ALTER TABLE operations_invoices DROP COLUMN workspace_id;
ALTER TABLE operations_invoices ADD CONSTRAINT operations_invoices_pkey PRIMARY KEY (invoice);
CREATE INDEX ops_invoices_date_idx ON operations_invoices (invoice_date);
CREATE INDEX ops_invoices_customer_idx ON operations_invoices (customer_id);

ALTER TABLE operations_products DROP CONSTRAINT operations_products_pkey;
ALTER TABLE operations_products DROP COLUMN workspace_id;
ALTER TABLE operations_products ADD CONSTRAINT operations_products_pkey PRIMARY KEY (stock_code);

ALTER TABLE operations_customers DROP CONSTRAINT operations_customers_pkey;
ALTER TABLE operations_customers DROP COLUMN workspace_id;
ALTER TABLE operations_customers ADD CONSTRAINT operations_customers_pkey PRIMARY KEY (customer_id);

-- Workspace files
DROP INDEX workspace_files_ws_idx;
ALTER TABLE workspace_files DROP COLUMN content_hash, DROP COLUMN workspace_id;

DROP TABLE data_imports;

-- Legacy market_/product_ tables (empty), DDL extracted verbatim from the
-- pre-migration backup.

CREATE TABLE public.market_competitive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    market_id uuid NOT NULL,
    competitor_count integer NOT NULL,
    market_saturation real NOT NULL,
    market_concentration real NOT NULL,
    competitive_density real NOT NULL,
    top_players jsonb NOT NULL,
    competitive_pressure_score real NOT NULL,
    entry_difficulty_score real NOT NULL,
    industry_breakdown jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.market_markets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    parent_id uuid,
    continent text,
    gdp real NOT NULL,
    gdp_growth real NOT NULL,
    gdp_per_capita real NOT NULL,
    population real NOT NULL,
    internet_penetration real NOT NULL,
    mobile_adoption real NOT NULL,
    urbanization real NOT NULL,
    avg_income real NOT NULL,
    purchasing_power_index real NOT NULL,
    ease_of_doing_business real NOT NULL,
    tax_rate real NOT NULL,
    inflation_rate real NOT NULL,
    currency_stability real NOT NULL,
    consumer_spending real NOT NULL,
    industry_growth jsonb NOT NULL,
    market_attractiveness_score real NOT NULL,
    opportunity_score real NOT NULL,
    risk_score real NOT NULL,
    ease_of_entry real NOT NULL,
    historical_gdp jsonb NOT NULL,
    historical_growth jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.market_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    market_id uuid NOT NULL,
    market_name text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    opportunity_score real NOT NULL,
    market_potential real NOT NULL,
    expected_revenue real NOT NULL,
    confidence_score real NOT NULL,
    time_horizon text NOT NULL,
    drivers jsonb NOT NULL,
    risks jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.market_scenarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    market_id uuid NOT NULL,
    market_name text NOT NULL,
    strategy text NOT NULL,
    budget real NOT NULL,
    team_size integer NOT NULL,
    product_category text NOT NULL,
    pricing_strategy text NOT NULL,
    marketing_spend real NOT NULL,
    results jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    anonymous_id character varying(255),
    session_id character varying(255),
    event_name character varying(255) NOT NULL,
    event_category character varying(100),
    properties jsonb,
    page character varying(500),
    referrer character varying(500),
    device_type character varying(50),
    browser character varying(100),
    country character varying(100),
    received_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.product_experiment_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    variant character varying(100) NOT NULL,
    metric character varying(255) NOT NULL,
    sample_size integer DEFAULT 0,
    conversions integer DEFAULT 0,
    conversion_rate real DEFAULT 0,
    mean_value real,
    std_dev real,
    lift_percent real,
    p_value real,
    confidence_interval jsonb,
    is_significant boolean DEFAULT false,
    verdict character varying(50),
    calculated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_experiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    hypothesis text,
    status character varying(50) DEFAULT 'draft'::character varying,
    type character varying(50) DEFAULT 'ab'::character varying,
    variants jsonb,
    primary_metric character varying(255),
    secondary_metrics jsonb,
    target_segment character varying(255),
    traffic_allocation real DEFAULT 100,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    category character varying(100),
    tracking_event character varying(255),
    is_core boolean DEFAULT false,
    launched_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50),
    target_value real,
    current_value real,
    unit character varying(50),
    quarter character varying(20),
    status character varying(50) DEFAULT 'on_track'::character varying,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_initiatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    opportunity_id uuid,
    status character varying(50) DEFAULT 'backlog'::character varying,
    reach real DEFAULT 0,
    impact real DEFAULT 0,
    confidence real DEFAULT 0,
    effort real DEFAULT 0,
    rice_score real DEFAULT 0,
    ice_score real DEFAULT 0,
    wsjf_score real DEFAULT 0,
    priority_score real DEFAULT 0,
    strategic_alignment real DEFAULT 0,
    expected_roi real DEFAULT 0,
    expected_retention_lift real DEFAULT 0,
    expected_revenue_lift real DEFAULT 0,
    engineering_cost integer DEFAULT 0,
    recommendation text,
    quarter character varying(20),
    tags jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    description text,
    opportunity_score real DEFAULT 0,
    user_impact real DEFAULT 0,
    business_impact real DEFAULT 0,
    confidence_score real DEFAULT 0,
    evidence jsonb,
    affected_users integer DEFAULT 0,
    status character varying(50) DEFAULT 'active'::character varying,
    discovered_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_roadmap_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    initiative_id uuid,
    name character varying(255) NOT NULL,
    quarter character varying(20) NOT NULL,
    status character varying(50) DEFAULT 'planned'::character varying,
    priority integer DEFAULT 0,
    estimated_weeks integer DEFAULT 2,
    dependencies jsonb,
    expected_outcome text,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.product_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anonymous_id character varying(255),
    email character varying(255),
    name character varying(255),
    plan character varying(50) DEFAULT 'free'::character varying,
    country character varying(100),
    company character varying(255),
    role character varying(100),
    signup_source character varying(100),
    signed_up_at timestamp without time zone DEFAULT now(),
    last_seen_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    traits jsonb
);

ALTER TABLE ONLY public.market_competitive
    ADD CONSTRAINT market_competitive_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.market_markets
    ADD CONSTRAINT market_markets_code_unique UNIQUE (code);

ALTER TABLE ONLY public.market_markets
    ADD CONSTRAINT market_markets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.market_opportunities
    ADD CONSTRAINT market_opportunities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.market_scenarios
    ADD CONSTRAINT market_scenarios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_events
    ADD CONSTRAINT product_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_experiment_results
    ADD CONSTRAINT product_experiment_results_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_experiments
    ADD CONSTRAINT product_experiments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_features
    ADD CONSTRAINT product_features_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_features
    ADD CONSTRAINT product_features_slug_unique UNIQUE (slug);

ALTER TABLE ONLY public.product_goals
    ADD CONSTRAINT product_goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_initiatives
    ADD CONSTRAINT product_initiatives_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_opportunities
    ADD CONSTRAINT product_opportunities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_roadmap_items
    ADD CONSTRAINT product_roadmap_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_users
    ADD CONSTRAINT product_users_pkey PRIMARY KEY (id);

CREATE INDEX product_events_event_name_idx ON public.product_events USING btree (event_name);

CREATE INDEX product_events_received_at_idx ON public.product_events USING btree (received_at);

CREATE INDEX product_events_session_id_idx ON public.product_events USING btree (session_id);

CREATE INDEX product_events_user_id_idx ON public.product_events USING btree (user_id);

CREATE INDEX product_users_anonymous_id_idx ON public.product_users USING btree (anonymous_id);

CREATE INDEX product_users_email_idx ON public.product_users USING btree (email);

CREATE INDEX product_users_signed_up_at_idx ON public.product_users USING btree (signed_up_at);

ALTER TABLE ONLY public.product_events
    ADD CONSTRAINT product_events_user_id_product_users_id_fk FOREIGN KEY (user_id) REFERENCES public.product_users(id);

ALTER TABLE ONLY public.product_experiment_results
    ADD CONSTRAINT product_experiment_results_experiment_id_product_experiments_id FOREIGN KEY (experiment_id) REFERENCES public.product_experiments(id);

ALTER TABLE ONLY public.product_initiatives
    ADD CONSTRAINT product_initiatives_opportunity_id_product_opportunities_id_fk FOREIGN KEY (opportunity_id) REFERENCES public.product_opportunities(id);

ALTER TABLE ONLY public.product_roadmap_items
    ADD CONSTRAINT product_roadmap_items_initiative_id_product_initiatives_id_fk FOREIGN KEY (initiative_id) REFERENCES public.product_initiatives(id);
