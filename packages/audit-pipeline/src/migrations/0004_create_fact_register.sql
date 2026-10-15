CREATE TABLE IF NOT EXISTS fact_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'extracted', 'connector')),
  source_id text,
  confidence double precision NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fact_sheet_id, fact_key)
);

CREATE INDEX IF NOT EXISTS idx_fact_register_fact_sheet ON fact_register(fact_sheet_id);
CREATE INDEX IF NOT EXISTS idx_fact_register_key ON fact_register(fact_key);
