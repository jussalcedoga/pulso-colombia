ALTER TABLE reports
  ADD COLUMN post_type TEXT NOT NULL DEFAULT 'need'
  CHECK (post_type IN ('need', 'offer', 'update'));

CREATE INDEX idx_reports_post_type ON reports(post_type, status, created_at DESC);
