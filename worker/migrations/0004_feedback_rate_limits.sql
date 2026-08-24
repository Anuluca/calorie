CREATE TABLE IF NOT EXISTS feedback_rate_limits (
  rate_key TEXT PRIMARY KEY NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_rate_limits_updated_at_idx
  ON feedback_rate_limits (updated_at);
