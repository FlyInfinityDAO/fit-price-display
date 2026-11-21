CREATE TABLE IF NOT EXISTS image_preview_usage (
  client_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (client_hash, day)
);

CREATE TABLE IF NOT EXISTS image_preview_daily_usage (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
