\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 78);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '078_tenant_onboarding_role_templates'
) AS already_applied \gset

\if :already_applied
  \echo '078_tenant_onboarding_role_templates ya aplicada'
\else
  -- TenantService reads these non-sensitive global templates while creating
  -- default tenant roles. Mutations remain reserved for platform administrators.
  GRANT SELECT ON public.default_role_templates TO nexodocs_app;
  INSERT INTO app.schema_migrations(version) VALUES ('078_tenant_onboarding_role_templates');
  \echo '078_tenant_onboarding_role_templates aplicada exitosamente'
\endif
COMMIT;
