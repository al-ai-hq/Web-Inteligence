CREATE TABLE IF NOT EXISTS content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES content_briefs(id),
  project_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('drafting', 'review', 'approved', 'published')),
  
  author text NOT NULL,
  ai_assisted boolean NOT NULL DEFAULT false,
  ai_disclosure text,
  
  client_input_received boolean NOT NULL DEFAULT false,
  client_input_notes text,
  
  content jsonb NOT NULL DEFAULT '[]',
  facts_used jsonb NOT NULL DEFAULT '[]',
  internal_links jsonb NOT NULL DEFAULT '[]',
  schema_json_ld jsonb,
  
  word_count jsonb NOT NULL,
  reading_time_minutes jsonb NOT NULL,
  
  arabic_reviewer text,
  arabic_review_date date,
  arabic_review_notes text,
  
  cms_draft_url text,
  cms_pr_url text,
  published_url text,
  published_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_updated_content_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_drafts_brief ON content_drafts(brief_id);
CREATE INDEX idx_content_drafts_project ON content_drafts(project_id);
CREATE INDEX idx_content_drafts_status ON content_drafts(status);
