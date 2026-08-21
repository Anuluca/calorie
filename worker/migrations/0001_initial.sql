CREATE TABLE IF NOT EXISTS query_cache (
  query_hash TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_query_cache_expires_at
ON query_cache(expires_at);
