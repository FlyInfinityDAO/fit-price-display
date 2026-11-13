CREATE TABLE IF NOT EXISTS wallet_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ludo_wallet_nonces_expiry ON wallet_nonces(expires_at);

CREATE TABLE IF NOT EXISTS websocket_tickets (
  ticket TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ludo_websocket_tickets_expiry ON websocket_tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_ludo_websocket_tickets_room ON websocket_tickets(room_code);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ludo_player_results (
  room_code TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  outcome TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(room_code,wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_ludo_player_results_wallet ON ludo_player_results(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ludo_player_results_points ON ludo_player_results(points DESC);
