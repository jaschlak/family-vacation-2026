CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS messages_by_scope_and_time
ON messages (activity_id, created_at, id);
