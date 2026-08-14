PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX idx_users_single_moderator
  ON users(role)
  WHERE role = 'moderator';
