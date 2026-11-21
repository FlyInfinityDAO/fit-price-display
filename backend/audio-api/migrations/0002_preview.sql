CREATE TABLE IF NOT EXISTS audio_preview_usage (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  characters INTEGER NOT NULL DEFAULT 0 CHECK(characters >= 0),
  updated_at INTEGER NOT NULL
);
