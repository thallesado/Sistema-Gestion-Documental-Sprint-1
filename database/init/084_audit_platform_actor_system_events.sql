\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('084_audit_platform_actor_system_events'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='084_audit_platform_actor_system_events') AS already_applied \gset
\if :already_applied
  \echo '084_audit_platform_actor_system_events ya aplicada'
\else
  -- Only the non-login security-definer role uses this policy. The audit actor
  -- validation trigger verifies a non-null platform_actor_id against users.
  ALTER POLICY audit_security_definer_system_insert ON public.audit_events
    WITH CHECK (user_id IS NULL);
  INSERT INTO app.schema_migrations(version) VALUES ('084_audit_platform_actor_system_events');
\endif
COMMIT;
