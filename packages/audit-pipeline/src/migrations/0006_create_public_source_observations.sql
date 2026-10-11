CREATE TABLE IF NOT EXISTS public_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  source_platform text NOT NULL,
  source_url text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  profile_data jsonb NOT NULL DEFAULT '{}',
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_source_obs_fact_sheet ON public_source_observations(fact_sheet_id);
CREATE INDEX idx_public_source_obs_platform ON public_source_observations(source_platform);
