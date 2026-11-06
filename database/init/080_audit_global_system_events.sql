\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('080_audit_global_system_events'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='080_audit_global_system_events') AS already_applied \gset
\if :already_applied
  \echo '080_audit_global_system_events ya aplicada'
\else
  -- Security-definer audit triggers may record actorless bootstrap/system
  -- events for global platform identities as well as tenant-scoped changes.
  -- Only the non-login nexodocs_security role can use this permissive policy.
  ALTER POLICY audit_security_definer_system_insert ON public.audit_events
    WITH CHECK (user_id IS NULL AND platform_actor_id IS NULL);
  INSERT INTO app.schema_migrations(version) VALUES ('080_audit_global_system_events');
\endif
COMMIT;
