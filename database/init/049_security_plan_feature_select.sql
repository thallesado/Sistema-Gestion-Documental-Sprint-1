\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 49);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '049_security_plan_feature_select') AS already_applied \gset
\if :already_applied
  \echo '049_security_plan_feature_select ya aplicada'
\else
  -- 048 makes app.has_permission read the global feature catalog as nexodocs_security.
  -- Without this grant every plan-aware RLS permission check fails.
  GRANT SELECT ON public.plan_features TO nexodocs_security;
  INSERT INTO app.schema_migrations(version) VALUES ('049_security_plan_feature_select');
\endif
COMMIT;
