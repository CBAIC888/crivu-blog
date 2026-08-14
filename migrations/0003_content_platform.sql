PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('general', 'research', 'script')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'zh-Hant',
  cover_media_id TEXT,
  cover_url TEXT,
  published_at TEXT,
  scheduled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  license TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_articles_public ON articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_type_status ON articles (type, status, published_at DESC);

CREATE TABLE IF NOT EXISTS article_translations (
  article_id TEXT NOT NULL,
  language TEXT NOT NULL,
  translation_article_id TEXT NOT NULL,
  hreflang TEXT NOT NULL,
  PRIMARY KEY (article_id, language),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (translation_article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS research_sections (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (article_id, section_key),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  note_number INTEGER NOT NULL,
  body_markdown TEXT NOT NULL,
  citation_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (article_id, note_number),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  orcid TEXT,
  institution TEXT,
  bio TEXT
);

CREATE TABLE IF NOT EXISTS article_authors (
  article_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_corresponding INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, author_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('collection', 'journal_issue')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  title TEXT NOT NULL,
  theme TEXT,
  cover_media_id TEXT,
  cover_url TEXT,
  editor_note TEXT,
  year INTEGER,
  volume TEXT,
  issue_number TEXT,
  published_at TEXT,
  pdf_media_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (pdf_media_id) REFERENCES media(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_public ON collections (status, published_at DESC);

CREATE TABLE IF NOT EXISTS collection_articles (
  collection_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, article_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'project',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  title TEXT NOT NULL,
  summary TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  location TEXT,
  participants TEXT,
  editor TEXT,
  cover_media_id TEXT,
  cover_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_public ON projects (status, start_date DESC);

CREATE TABLE IF NOT EXISTS project_relations (
  project_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('article', 'translation', 'gallery', 'exhibition', 'collection', 'media')),
  target_id TEXT NOT NULL,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, relation_type, target_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  seo_title TEXT,
  seo_description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  title TEXT,
  alt_text TEXT,
  caption TEXT,
  creator TEXT,
  period TEXT,
  source TEXT,
  license TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  public_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_media_created ON media (created_at DESC);

CREATE TABLE IF NOT EXISTS media_relations (
  media_id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('article', 'collection', 'project', 'page')),
  owner_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'attachment',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (media_id, owner_type, owner_id, role),
  FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_revisions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (article_id, version),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions (article_id, version DESC);

CREATE TABLE IF NOT EXISTS guestbook_entries (
  id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  author_email_hash TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'spam')),
  source TEXT NOT NULL DEFAULT 'public',
  ip_hash TEXT,
  user_agent_hash TEXT,
  admin_reply TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_guestbook_status_created ON guestbook_entries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guestbook_ip_created ON guestbook_entries (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL UNIQUE,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO guestbook_entries (
  id, author_name, author_email_hash, body, status, source, ip_hash,
  user_agent_hash, created_at, updated_at, approved_at
)
SELECT id, author_name, author_email_hash, body, status, source, ip_hash,
  user_agent_hash, created_at, updated_at, approved_at
FROM comments
WHERE slug = 'about';
