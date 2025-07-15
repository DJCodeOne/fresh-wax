-- migrations/0001_create_subscribers_table.sql
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);