CREATE TABLE IF NOT EXISTS fact_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  fact_sheet_id uuid NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_manifest_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_manifest_id uuid NOT NULL REFERENCES fact_manifests(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('product', 'service', 'pricing', 'credential', 'result', 'review', 'policy')),
  statement text NOT NULL,
  evidence jsonb NOT NULL,
  regulated boolean NOT NULL DEFAULT false,
  regulated_topic text CHECK (regulated_topic IN ('health', 'finance', 'legal', null)),
  requires_professional_review boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_manifest_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL REFERENCES fact_manifest_facts(id) ON DELETE CASCADE,
  draft_id uuid,
  citation_text text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fact_manifests_project ON fact_manifests(project_id);
CREATE INDEX idx_fact_manifest_facts_manifest ON fact_manifest_facts(fact_manifest_id);
CREATE INDEX idx_fact_manifest_citations_fact ON fact_manifest_citations(fact_id);
CREATE INDEX idx_fact_manifest_citations_draft ON fact_manifest_citations(draft_id);
