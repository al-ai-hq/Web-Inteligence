CREATE TABLE IF NOT EXISTS content_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  audit_id uuid,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  
  opportunity_type text NOT NULL CHECK (opportunity_type IN ('unmapped_cluster', 'low_ctr', 'visibility_gap', 'aeo_failure')),
  opportunity_ref text NOT NULL,
  
  page_goal text NOT NULL,
  audience text NOT NULL,
  target_action text NOT NULL,
  target_url text,
  proposed_slug text,
  
  primary_keyword text NOT NULL,
  keyword_variants jsonb NOT NULL DEFAULT '[]',
  intent text NOT NULL CHECK (intent IN ('informational', 'navigational', 'commercial', 'transactional')),
  market text NOT NULL,
  volume integer,
  volume_source text,
  position double precision,
  position_source text,
  
  observations jsonb NOT NULL DEFAULT '[]',
  recommended_angle text NOT NULL,
  outlines jsonb NOT NULL DEFAULT '[]',
  questions jsonb NOT NULL DEFAULT '[]',
  entities jsonb NOT NULL DEFAULT '[]',
  terms jsonb NOT NULL DEFAULT '[]',
  titles jsonb NOT NULL DEFAULT '[]',
  meta_descriptions jsonb NOT NULL DEFAULT '[]',
  
  fact_sheet_ids jsonb NOT NULL DEFAULT '[]',
  inputs_needed jsonb NOT NULL DEFAULT '[]',
  internal_links jsonb NOT NULL DEFAULT '[]',
  schema_types jsonb NOT NULL DEFAULT '[]',
  length_guidance jsonb NOT NULL,
  
  cta text NOT NULL,
  conversion_notes text NOT NULL,
  regulated_topic text CHECK (regulated_topic IN ('health', 'finance', 'legal', null)),
  
  success_measures jsonb NOT NULL DEFAULT '[]',
  review_date date NOT NULL,
  
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_briefs_project ON content_briefs(project_id);
CREATE INDEX idx_content_briefs_status ON content_briefs(status);
CREATE INDEX idx_content_briefs_opportunity ON content_briefs(opportunity_type, opportunity_ref);
