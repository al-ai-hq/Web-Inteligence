CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  audit_id_applied uuid NOT NULL REFERENCES audits (id) ON DELETE CASCADE,
  audit_id_measured uuid REFERENCES audits (id) ON DELETE SET NULL,
  metric text NOT NULL CHECK (metric IN ('presence_readiness','crawlability','on_page','structured_data','aeo','geo','i18n_accessibility','performance_security')),
  value_before numeric,
  value_after numeric,
  as_of_before timestamptz,
  as_of_after timestamptz,
  fidelity_label text NOT NULL DEFAULT 'correlation_only' CHECK (fidelity_label IN ('correlation_only','measured','inferred')),
  source text NOT NULL DEFAULT 'user_marked_applied',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_id, audit_id_applied, metric)
);
CREATE INDEX IF NOT EXISTS recommendation_outcomes_user_applied_idx ON recommendation_outcomes (user_id, audit_id_applied);
CREATE INDEX IF NOT EXISTS recommendation_outcomes_user_rule_pending_idx ON recommendation_outcomes (user_id, rule_id) WHERE audit_id_measured IS NULL;
