CREATE TABLE IF NOT EXISTS user_profiles (
  address TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  updated_at INTEGER NOT NULL
);
