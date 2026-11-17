\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('082_workflow_template_trigger_context'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='082_workflow_template_trigger_context') AS already_applied \gset
\if :already_applied
  \echo '082_workflow_template_trigger_context ya aplicada'
\else
  -- These internal guards validate tenant-scoped references under FORCE RLS.
  -- Their non-login owner can see the referenced rows; each function itself
  -- still constrains every lookup to NEW/OLD.tenant_id.
  ALTER FUNCTION app.lock_workflow_template() OWNER TO nexodocs_platform_admin;
  ALTER FUNCTION app.protect_used_template() OWNER TO nexodocs_platform_admin;
  ALTER FUNCTION app.set_task_template() OWNER TO nexodocs_platform_admin;
  INSERT INTO app.schema_migrations(version) VALUES ('082_workflow_template_trigger_context');
\endif
COMMIT;
