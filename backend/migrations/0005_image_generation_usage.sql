-- Independent production image-generation quotas; these do not touch chat usage.
CREATE TABLE IF NOT EXISTS image_generation_usage (
  address TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (address, day)
);

CREATE INDEX IF NOT EXISTS idx_image_generation_usage_day
  ON image_generation_usage(day);

CREATE TABLE IF NOT EXISTS image_generation_daily_usage (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  updated_at INTEGER NOT NULL
);
