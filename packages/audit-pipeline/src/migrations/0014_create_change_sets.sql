CREATE TABLE IF NOT EXISTS change_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  description text NOT NULL,
  risk_tier integer NOT NULL CHECK (risk_tier IN (1, 2, 3)),
  status text NOT NULL CHECK (status IN ('draft', 'validated', 'previewed', 'approved', 'rejected')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id uuid NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id uuid NOT NULL REFERENCES change_sets(id),
  risk_tier integer NOT NULL,
  approvers jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_sets_project ON change_sets(project_id);
CREATE INDEX IF NOT EXISTS idx_change_sets_status ON change_sets(status);
CREATE INDEX IF NOT EXISTS idx_change_set_items_change_set ON change_set_items(change_set_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_change_set ON approval_records(change_set_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_status ON approval_records(status);
