PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS social_auth_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_social_nonces_wallet_created
  ON social_auth_nonces(wallet_address, created_at);
CREATE INDEX IF NOT EXISTS idx_social_nonces_expiry
  ON social_auth_nonces(expires_at);

CREATE TABLE IF NOT EXISTS social_sessions (
  token_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_social_sessions_wallet
  ON social_sessions(wallet_address, expires_at);
CREATE INDEX IF NOT EXISTS idx_social_sessions_expiry
  ON social_sessions(expires_at);

CREATE TABLE IF NOT EXISTS social_profiles (
  wallet_address TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_media_key TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_profiles_handle
  ON social_profiles(handle COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS social_media_objects (
  media_key TEXT PRIMARY KEY,
  owner_wallet TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','audio')),
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size > 0),
  state TEXT NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','attached','removed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attached_post_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_social_media_owner_created
  ON social_media_objects(owner_wallet, created_at);
CREATE INDEX IF NOT EXISTS idx_social_media_expiry
  ON social_media_objects(state, expires_at);

CREATE TABLE IF NOT EXISTS social_posts (
  post_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES social_profiles(wallet_address),
  title TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','audio','prompt')),
  description TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  media_key TEXT UNIQUE,
  source_post_id TEXT,
  source_wallet TEXT,
  source_title TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')),
  moderation_state TEXT NOT NULL DEFAULT 'clear' CHECK(moderation_state IN ('clear','review','restricted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_posts_feed
  ON social_posts(status, created_at DESC, post_id DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_wallet
  ON social_posts(wallet_address, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_type
  ON social_posts(media_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS social_likes (
  post_id TEXT NOT NULL REFERENCES social_posts(post_id),
  wallet_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(post_id, wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_social_likes_wallet
  ON social_likes(wallet_address, created_at DESC);

CREATE TABLE IF NOT EXISTS social_follows (
  follower_wallet TEXT NOT NULL,
  following_wallet TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(follower_wallet, following_wallet),
  CHECK(follower_wallet <> following_wallet)
);
CREATE INDEX IF NOT EXISTS idx_social_follows_following
  ON social_follows(following_wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS social_challenges (
  challenge_id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','audio')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed','archived')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_challenges_active
  ON social_challenges(status, ends_at);

CREATE TABLE IF NOT EXISTS social_challenge_submissions (
  challenge_id TEXT NOT NULL REFERENCES social_challenges(challenge_id),
  post_id TEXT NOT NULL REFERENCES social_posts(post_id),
  wallet_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(challenge_id, post_id),
  UNIQUE(challenge_id, wallet_address, post_id)
);
CREATE INDEX IF NOT EXISTS idx_social_challenge_submissions_challenge
  ON social_challenge_submissions(challenge_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_challenge_votes (
  challenge_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(challenge_id, post_id, voter_wallet),
  UNIQUE(challenge_id, voter_wallet),
  FOREIGN KEY(challenge_id, post_id)
    REFERENCES social_challenge_submissions(challenge_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_social_challenge_votes_post
  ON social_challenge_votes(challenge_id, post_id);

CREATE TABLE IF NOT EXISTS social_reports (
  report_id TEXT PRIMARY KEY,
  reporter_wallet TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('post','creator')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('copyright','harassment','spam','unsafe','impersonation','other')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','resolved','dismissed')),
  created_at INTEGER NOT NULL,
  UNIQUE(reporter_wallet, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_social_reports_status_created
  ON social_reports(status, created_at);

CREATE TABLE IF NOT EXISTS social_rate_limits (
  rate_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(rate_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_social_rate_limits_window
  ON social_rate_limits(window_start);

INSERT OR IGNORE INTO social_challenges
  (challenge_id, media_type, title, description, starts_at, ends_at, status, created_at)
VALUES
  ('city-of-tomorrow-2026-w48', 'image', 'Imagine the city of tomorrow',
   'Create a vision of a future city in the Fly Infinity universe. Share the artwork and the prompt that shaped it.',
   1795305600, 1795996800, 'active', 1795305600),
  ('sound-of-tomorrow-2026-w48', 'audio', 'Compose the sound of tomorrow',
   'Create an original soundtrack or soundscape inspired by the future of Fly Infinity.',
   1795305600, 1795996800, 'active', 1795305600);
