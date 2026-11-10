CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated ON conversations(address, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_expiry ON conversations(expires_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  address TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS user_memory_settings (
  address TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  source_conversation_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(address, memory_key)
);
CREATE INDEX IF NOT EXISTS idx_user_memories_owner_updated ON user_memories(address, updated_at DESC);
