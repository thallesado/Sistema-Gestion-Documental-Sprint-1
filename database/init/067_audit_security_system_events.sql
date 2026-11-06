\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('067_audit_security_system_events'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '067_audit_security_system_events', applied_at FROM app.schema_migrations WHERE version = '062_audit_security_system_events' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '067_audit_security_system_events') AS already_applied \gset
\if :already_applied
  \echo '067_audit_security_system_events ya aplicada'
\else
  -- SECURITY DEFINER triggers may record automated tenant lifecycle changes without
  -- an interactive user. Only the non-login security function owner may write these.
  CREATE POLICY audit_security_definer_system_insert ON public.audit_events
    FOR INSERT TO nexodocs_security
    WITH CHECK (tenant_id IS NOT NULL AND user_id IS NULL AND platform_actor_id IS NULL);
  INSERT INTO app.schema_migrations(version) VALUES ('067_audit_security_system_events');
\endif
COMMIT;
