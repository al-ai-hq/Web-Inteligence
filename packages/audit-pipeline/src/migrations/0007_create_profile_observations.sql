CREATE TABLE IF NOT EXISTS profile_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  extracted_name text,
  extracted_phone text,
  extracted_email text,
  extracted_address jsonb,
  extracted_hours jsonb,
  extracted_social jsonb,
  extraction_confidence double precision NOT NULL DEFAULT 0.0 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_obs_fact_sheet ON profile_observations(fact_sheet_id);
CREATE INDEX idx_profile_obs_source_url ON profile_observations(source_url);
