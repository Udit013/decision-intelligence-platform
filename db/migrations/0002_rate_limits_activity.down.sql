-- 0002 (down) · Remove rate-limit and activity tracking (no user data is affected).
DROP TABLE workspace_activity;
DROP TABLE rate_limits;
