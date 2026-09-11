-- Refresh rotation consumes a refresh token without invalidating access JWTs
-- already issued to other tabs. Logout/replay still invalidate the whole family.
ALTER TABLE sessions ADD COLUMN access_revoked_at timestamptz;
UPDATE sessions SET access_revoked_at=revoked_at WHERE revoked_at IS NOT NULL;
