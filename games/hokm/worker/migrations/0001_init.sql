CREATE TABLE IF NOT EXISTS wallet_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hokm_wallet_nonces_expiry ON wallet_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_hokm_wallet_nonces_wallet ON wallet_nonces(wallet_address);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
