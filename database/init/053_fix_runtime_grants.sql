\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 53);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '053_fix_runtime_grants') AS already_applied \gset
\if :already_applied
  \echo '053_fix_runtime_grants ya aplicada'
\else
  -- Migrations 046 and 051 granted only UPDATE/SELECT on these two columns, but
  -- Hibernate includes them in the INSERT issued by POST /api/v1/users.
  GRANT INSERT (preferred_language, must_change_password) ON public.users TO nexodocs_app;

  -- app.record_tenant_monthly_usage (046) is SECURITY DEFINER and owned by
  -- nexodocs_security, which had no privileges on the table. Document creation,
  -- storage and OCR usage recording failed with "permission denied".
  GRANT SELECT, INSERT, UPDATE ON public.tenant_usage_monthly TO nexodocs_security;

  INSERT INTO app.schema_migrations(version) VALUES ('053_fix_runtime_grants');
\endif
COMMIT;
