CREATE TABLE IF NOT EXISTS nap_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  name_value text,
  phone_value text,
  address_value jsonb,
  consistency_score double precision NOT NULL DEFAULT 0.0 CHECK (consistency_score >= 0 AND consistency_score <= 1),
  inconsistencies jsonb NOT NULL DEFAULT '[]',
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nap_obs_fact_sheet ON nap_observations(fact_sheet_id);
CREATE INDEX IF NOT EXISTS idx_nap_obs_consistency ON nap_observations(consistency_score);
