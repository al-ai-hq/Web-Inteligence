ALTER TABLE audits ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE audits ALTER COLUMN expires_at DROP NOT NULL;
CREATE INDEX IF NOT EXISTS audits_user_id_idx ON audits (user_id);
