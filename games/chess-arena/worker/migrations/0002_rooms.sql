CREATE TABLE IF NOT EXISTS websocket_tickets (
  ticket TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ws_tickets_expiry
  ON websocket_tickets(expires_at);
