CREATE TABLE IF NOT EXISTS login_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_rate_limits_blocked_until ON login_rate_limits(blocked_until);
