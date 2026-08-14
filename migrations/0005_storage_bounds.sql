CREATE INDEX idx_reports_user_created
  ON reports(user_id, created_at DESC);

CREATE INDEX idx_reports_status_updated
  ON reports(status, updated_at);

CREATE INDEX idx_chat_messages_created
  ON chat_messages(created_at);

CREATE INDEX idx_offers_report_status
  ON offers(report_id, status);

CREATE INDEX idx_offers_updated
  ON offers(updated_at);
