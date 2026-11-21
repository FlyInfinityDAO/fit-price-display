CREATE TABLE IF NOT EXISTS image_auth_nonces(
 nonce TEXT PRIMARY KEY,address TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_image_auth_nonces_address_created ON image_auth_nonces(address,created_at);
CREATE TABLE IF NOT EXISTS image_sessions(token_hash TEXT PRIMARY KEY,address TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_image_sessions_expiry ON image_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_image_sessions_address ON image_sessions(address);
CREATE TABLE IF NOT EXISTS image_generation_usage(address TEXT NOT NULL,day TEXT NOT NULL,requests INTEGER NOT NULL DEFAULT 0 CHECK(requests>=0),updated_at INTEGER NOT NULL,PRIMARY KEY(address,day));
CREATE INDEX IF NOT EXISTS idx_image_generation_usage_day ON image_generation_usage(day);
CREATE TABLE IF NOT EXISTS image_generation_daily_usage(day TEXT PRIMARY KEY,requests INTEGER NOT NULL DEFAULT 0 CHECK(requests>=0),updated_at INTEGER NOT NULL);
