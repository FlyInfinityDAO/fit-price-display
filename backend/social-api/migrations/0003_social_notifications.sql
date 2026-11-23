CREATE TABLE IF NOT EXISTS social_notifications (
  notification_id TEXT PRIMARY KEY,
  recipient_wallet TEXT NOT NULL REFERENCES social_profiles(wallet_address),
  actor_wallet TEXT NOT NULL REFERENCES social_profiles(wallet_address),
  notification_type TEXT NOT NULL CHECK(notification_type IN ('follow','like','repost')),
  post_id TEXT REFERENCES social_posts(post_id),
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  CHECK(recipient_wallet <> actor_wallet),
  CHECK(
    (notification_type = 'follow' AND post_id IS NULL) OR
    (notification_type IN ('like','repost') AND post_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_social_notifications_recipient
  ON social_notifications(recipient_wallet, created_at DESC, notification_id);

CREATE INDEX IF NOT EXISTS idx_social_notifications_unread
  ON social_notifications(recipient_wallet, read_at, created_at DESC);
