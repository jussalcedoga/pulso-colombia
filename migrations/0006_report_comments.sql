PRAGMA foreign_keys = ON;

CREATE TABLE report_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_report_comments_report
  ON report_comments(report_id, id);

CREATE INDEX idx_report_comments_user_created
  ON report_comments(user_id, created_at);

CREATE INDEX idx_report_comments_created
  ON report_comments(created_at);
