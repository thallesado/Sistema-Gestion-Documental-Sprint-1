\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('085_document_version_trigger_context'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='085_document_version_trigger_context') AS already_applied \gset
\if :already_applied
  \echo '085_document_version_trigger_context ya aplicada'
\else
  -- FORCE RLS hides rows from nexodocs_security when there is no policy for
  -- that internal role. The trigger validates a tenant-scoped version pointer;
  -- its query is constrained by NEW.id/tenant_id and must see the latest row.
  ALTER FUNCTION app.validate_current_version() OWNER TO nexodocs_platform_admin;
  INSERT INTO app.schema_migrations(version) VALUES ('085_document_version_trigger_context');
\endif
COMMIT;
