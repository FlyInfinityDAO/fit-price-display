ALTER TABLE social_sessions
  ADD COLUMN password_verified INTEGER NOT NULL DEFAULT 0;

ALTER TABLE social_profiles
  ADD COLUMN password_hash TEXT;

ALTER TABLE social_profiles
  ADD COLUMN password_salt TEXT;

ALTER TABLE social_profiles
  ADD COLUMN password_iterations INTEGER;

CREATE TABLE IF NOT EXISTS social_password_recovery_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_social_password_recovery_wallet
  ON social_password_recovery_nonces(wallet_address, created_at);
CREATE INDEX IF NOT EXISTS idx_social_password_recovery_expiry
  ON social_password_recovery_nonces(expires_at);

CREATE TABLE IF NOT EXISTS social_reposts (
  repost_id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES social_posts(post_id),
  wallet_address TEXT NOT NULL REFERENCES social_profiles(wallet_address),
  created_at INTEGER NOT NULL,
  UNIQUE(post_id, wallet_address),
  CHECK(length(post_id) BETWEEN 1 AND 80)
);
CREATE INDEX IF NOT EXISTS idx_social_reposts_feed
  ON social_reposts(created_at DESC, post_id);
CREATE INDEX IF NOT EXISTS idx_social_reposts_wallet
  ON social_reposts(wallet_address, created_at DESC);
