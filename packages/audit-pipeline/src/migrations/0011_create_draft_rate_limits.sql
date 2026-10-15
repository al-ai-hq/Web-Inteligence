CREATE TABLE IF NOT EXISTS draft_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  month_start date NOT NULL,
  draft_count integer NOT NULL DEFAULT 0,
  UNIQUE(project_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_draft_rate_limits_project_month ON draft_rate_limits(project_id, month_start);
