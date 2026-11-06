\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('073_security_definer_audit_actor_insert'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '073_security_definer_audit_actor_insert', applied_at FROM app.schema_migrations WHERE version = '068_security_definer_audit_actor_insert' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '073_security_definer_audit_actor_insert') AS already_applied \gset
\if :already_applied
  \echo '073_security_definer_audit_actor_insert ya aplicada'
\else
  CREATE POLICY audit_security_actor_insert ON public.audit_events
    FOR INSERT TO nexodocs_security
    WITH CHECK (
      tenant_id = app.current_tenant_id()
      AND user_id = app.current_user_id()
      AND platform_actor_id IS NULL
    );
  INSERT INTO app.schema_migrations(version) VALUES ('073_security_definer_audit_actor_insert');
\endif
COMMIT;
