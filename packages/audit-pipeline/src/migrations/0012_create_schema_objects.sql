CREATE TABLE IF NOT EXISTS schema_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  page_url text NOT NULL,
  schema_type text NOT NULL,
  json_ld jsonb NOT NULL,
  html_snippet text NOT NULL,
  source text NOT NULL CHECK (source IN ('audit', 'brief', 'manual')),
  status text NOT NULL CHECK (status IN ('proposed', 'approved', 'applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_objects_project ON schema_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_schema_objects_page ON schema_objects(page_url);
CREATE INDEX IF NOT EXISTS idx_schema_objects_type ON schema_objects(schema_type);
