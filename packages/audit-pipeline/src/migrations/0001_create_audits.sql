CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','ar')),
  tier text NOT NULL CHECK (tier IN ('rich','reduced','preview','refused')),
  context jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('QUEUED','VALIDATING','CRAWLING','EXTRACTING','AUDITING','ENRICHING_OPTIONAL','COMPOSING','READY_PARTIAL','READY_COMPLETE','FAILED','CANCELLED','EXPIRED')),
  failure_reason text,
  secret_hash text NOT NULL,
  report jsonb,
  costs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS audits_expires_at_idx ON audits (expires_at);
