PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS article_likes (
  article_id TEXT PRIMARY KEY,
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_likes_count ON article_likes (like_count DESC);
