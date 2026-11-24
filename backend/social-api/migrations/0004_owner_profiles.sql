PRAGMA foreign_keys = ON;

-- Owner Profile account metadata only.
-- Network genealogy, branch descendants and tree snapshots are never persisted.
CREATE TABLE IF NOT EXISTS owner_profiles (
  profile_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  primary_wallet_address TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_profile_wallets (
  wallet_address TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  added_at INTEGER NOT NULL,
  UNIQUE(profile_id, wallet_address)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_profile_one_primary_wallet
  ON owner_profile_wallets(profile_id) WHERE is_primary = 1;
CREATE INDEX IF NOT EXISTS idx_owner_profile_wallets_profile
  ON owner_profile_wallets(profile_id, is_primary DESC, added_at ASC);

CREATE TABLE IF NOT EXISTS owner_profile_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_owner_profile_nonces_expiry
  ON owner_profile_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_owner_profile_nonces_wallet
  ON owner_profile_nonces(wallet_address, created_at);

CREATE TABLE IF NOT EXISTS owner_profile_proofs (
  token_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_owner_profile_proofs_expiry
  ON owner_profile_proofs(expires_at);

CREATE TABLE IF NOT EXISTS owner_profile_sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_owner_profile_sessions_profile
  ON owner_profile_sessions(profile_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_owner_profile_sessions_expiry
  ON owner_profile_sessions(expires_at);
