-- Dedicated quota for isolated Fly AI image-generation tests.
-- This table is intentionally separate from the existing chat usage table.
CREATE TABLE IF NOT EXISTS image_test_usage (
  address TEXT NOT NULL,
  day TEXT NOT NULL,
  generations INTEGER NOT NULL DEFAULT 0 CHECK (generations >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (address, day)
);

CREATE INDEX IF NOT EXISTS idx_image_test_usage_day
  ON image_test_usage(day);
