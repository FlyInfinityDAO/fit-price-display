-- One account-wide test quota protects the shared Workers AI free allocation.
CREATE TABLE IF NOT EXISTS image_test_usage (
  day TEXT PRIMARY KEY,
  generations INTEGER NOT NULL DEFAULT 0 CHECK (generations >= 0),
  updated_at INTEGER NOT NULL
);
