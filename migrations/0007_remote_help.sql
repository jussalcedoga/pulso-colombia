PRAGMA foreign_keys = ON;

ALTER TABLE reports
  ADD COLUMN location_mode TEXT NOT NULL DEFAULT 'local'
  CHECK (location_mode IN ('local', 'remote'));

CREATE INDEX idx_reports_city_location_mode
  ON reports(city, location_mode, created_at DESC);
