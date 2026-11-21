CREATE TABLE IF NOT EXISTS audio_auth_nonces (
  nonce TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_audio_auth_nonces_address_created
  ON audio_auth_nonces(address, created_at);

CREATE TABLE IF NOT EXISTS audio_sessions (
  token_hash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audio_sessions_expiry ON audio_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audio_sessions_address ON audio_sessions(address);

CREATE TABLE IF NOT EXISTS audio_speech_usage (
  address TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  characters INTEGER NOT NULL DEFAULT 0 CHECK(characters >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(address, day)
);
CREATE INDEX IF NOT EXISTS idx_audio_speech_usage_day ON audio_speech_usage(day);

CREATE TABLE IF NOT EXISTS audio_speech_global_usage (
  day TEXT PRIMARY KEY,
  characters INTEGER NOT NULL DEFAULT 0 CHECK(characters >= 0),
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  updated_at INTEGER NOT NULL
);
