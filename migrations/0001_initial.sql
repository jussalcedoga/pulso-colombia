PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 60),
  city TEXT NOT NULL,
  recovery_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'volunteer', 'representative', 'moderator')),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL DEFAULT '',
  h3_cell TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  need_types TEXT NOT NULL,
  urgency INTEGER NOT NULL CHECK (urgency BETWEEN 1 AND 5),
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count BETWEEN 1 AND 10000),
  details TEXT NOT NULL CHECK (length(details) BETWEEN 10 AND 700),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'resolved')),
  confirmations INTEGER NOT NULL DEFAULT 0,
  flags INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_reports_city_status ON reports(city, status, created_at DESC);
CREATE INDEX idx_reports_cell ON reports(h3_cell);
CREATE INDEX idx_reports_user ON reports(user_id);

CREATE TABLE report_confirmations (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (report_id, user_id)
);

CREATE TABLE report_flags (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('incorrect', 'duplicate', 'unsafe', 'fraud', 'other')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (report_id, user_id)
);

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('supplies', 'transport', 'shelter', 'medical', 'volunteer', 'funds', 'other')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 500),
  response_message TEXT NOT NULL DEFAULT '' CHECK (length(response_message) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_offers_recipient ON offers(recipient_id, created_at DESC);
CREATE INDEX idx_offers_sender ON offers(sender_id, created_at DESC);
CREATE UNIQUE INDEX idx_offers_sender_report ON offers(sender_id, report_id)
  WHERE status IN ('pending', 'accepted');

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
