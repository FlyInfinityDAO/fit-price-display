CREATE TABLE IF NOT EXISTS wallet_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wallet_nonces_expiry_idx ON wallet_nonces(expires_at);
CREATE TABLE IF NOT EXISTS websocket_tickets (
  ticket TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS websocket_tickets_expiry_idx ON websocket_tickets(expires_at);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS snakes_player_results (
  room_code TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  outcome TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(room_code,wallet_address)
);
CREATE INDEX IF NOT EXISTS snakes_player_points_idx ON snakes_player_results(points DESC);
