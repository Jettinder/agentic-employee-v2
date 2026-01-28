CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT,
  message TEXT,
  data TEXT,
  created_at TEXT NOT NULL
);
