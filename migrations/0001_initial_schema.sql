PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrator', 'operator', 'moderator', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL UNIQUE,
  start_time TEXT NOT NULL DEFAULT '13:00',
  end_time TEXT NOT NULL DEFAULT '15:30',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed')),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS symposium_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_symposium_sessions_event_order ON symposium_sessions(event_id, sort_order);

CREATE TABLE IF NOT EXISTS presenters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES symposium_sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  affiliation TEXT NOT NULL DEFAULT '',
  presentation_title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_presenters_session_order ON presenters(session_id, sort_order);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  presenter_id TEXT NOT NULL REFERENCES presenters(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'event')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_materials_presenter ON materials(presenter_id);

CREATE TABLE IF NOT EXISTS presentation_links (
  id TEXT PRIMARY KEY,
  presenter_id TEXT NOT NULL REFERENCES presenters(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Presentation link',
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS timer_states (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

INSERT OR IGNORE INTO events (id, title, event_date, status)
VALUES
  ('event-2026-11-12', 'Symposium', '2026-11-12', 'draft'),
  ('event-2026-11-26', 'Symposium', '2026-11-26', 'draft'),
  ('event-2026-12-03', 'Symposium', '2026-12-03', 'draft');

INSERT OR IGNORE INTO symposium_sessions (id, event_id, title, sort_order)
VALUES ('session-2026-11-26-main', 'event-2026-11-26', 'Main session', 1),
       ('session-2026-12-03-main', 'event-2026-12-03', 'Main session', 1),
       ('session-2026-11-12-main', 'event-2026-11-12', 'Main session', 1);

INSERT OR IGNORE INTO presenters (id, session_id, display_name, presentation_title, sort_order)
VALUES
('presenter-26-01','session-2026-11-26-main','Presenter 1','Pengaruh AI Literacy terhadap Perilaku Pemanfaatan Generative AI Berdasarkan Disiplin Ilmu Mahasiswa.',1),
('presenter-26-02','session-2026-11-26-main','Presenter 2','Perilaku Pustakawan dan AI: Embedding Peran dan AI.',2),
('presenter-26-03','session-2026-11-26-main','Presenter 3','Eksplorasi Perilaku Informasi Generasi Z terhadap Berita Berbasis AI Generatif di TikTok.',3),
('presenter-26-04','session-2026-11-26-main','Presenter 4','Analisis Kesiapan Perpustakaan Nasional dalam Pelestarian Karya Rekam Film Digital.',4),
('presenter-26-05','session-2026-11-26-main','Presenter 5','Analisis Ketangguhan Preservasi Digital Naskah Kuno Perpustakaan Nasional RI terhadap Ancaman Bencana.',5),
('presenter-26-06','session-2026-11-26-main','Presenter 6','Akselerasi Pengolahan Arsip Statis dan Dilema Granularitas Deskripsi.',6);