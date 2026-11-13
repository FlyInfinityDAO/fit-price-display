CREATE TABLE IF NOT EXISTS local_matches (
  match_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  state_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','finished')),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ludo_local_matches_wallet ON local_matches(wallet_address,status);
CREATE INDEX IF NOT EXISTS idx_ludo_local_matches_updated ON local_matches(updated_at);
