CREATE TABLE IF NOT EXISTS fact_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  site_url text NOT NULL,
  business_name text NOT NULL,
  description text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  address_locality text,
  address_region text,
  address_postal_code text,
  address_country text,
  geo_latitude double precision,
  geo_longitude double precision,
  social_profiles jsonb NOT NULL DEFAULT '{}',
  brand_terms jsonb NOT NULL DEFAULT '{}',
  operating_hours jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'superseded')),
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fact_sheets_project ON fact_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_fact_sheets_site_url ON fact_sheets(site_url);
CREATE INDEX IF NOT EXISTS idx_fact_sheets_status ON fact_sheets(status);
