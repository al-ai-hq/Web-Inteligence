CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  site_url TEXT NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider, site_url)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider_site
  ON oauth_tokens (user_id, provider, site_url);
