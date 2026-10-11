CREATE TABLE IF NOT EXISTS entity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  confirmed_value jsonb,
  conflicting_value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('nap_inconsistency', 'extractor_disagreement', 'connector_conflict')),
  source_id text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'owner_confirmed_value', 'correction_requested', 'resolved', 'dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  resolution_note text,
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_conflicts_fact_sheet ON entity_conflicts(fact_sheet_id);
CREATE INDEX idx_entity_conflicts_status ON entity_conflicts(status);
CREATE INDEX idx_entity_conflicts_severity ON entity_conflicts(severity);
