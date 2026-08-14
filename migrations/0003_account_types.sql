ALTER TABLE users
  ADD COLUMN account_type TEXT NOT NULL DEFAULT 'resident'
  CHECK (account_type IN ('resident', 'volunteer', 'sponsor'));
