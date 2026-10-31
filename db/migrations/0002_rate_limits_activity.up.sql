-- 0002 · Fixed-window rate-limit counters and per-workspace activity (for expiry).
-- Additive only: no existing table is touched.

CREATE TABLE rate_limits (
  bucket text PRIMARY KEY,           -- "<scope>:<action>:<subject-hash>:<window-index>"
  hits integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expires_idx ON rate_limits (expires_at);

CREATE TABLE workspace_activity (
  workspace_id uuid PRIMARY KEY,
  last_active_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_activity_last_idx ON workspace_activity (last_active_at);

-- Existing visitor workspaces start a fresh 90-day clock now. The demo workspace
-- is deliberately never given an activity row, so it can never expire.
INSERT INTO workspace_activity (workspace_id)
SELECT DISTINCT workspace_id FROM (
  SELECT workspace_id FROM workspace_files
  UNION SELECT workspace_id FROM data_imports
  UNION SELECT workspace_id FROM operations_invoice_lines
  UNION SELECT workspace_id FROM market_indicators
  UNION SELECT workspace_id FROM product_tracked_events
) w
WHERE workspace_id <> '00000000-0000-4000-8000-000000000000'
ON CONFLICT DO NOTHING;
