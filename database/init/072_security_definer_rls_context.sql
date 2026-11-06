\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('072_security_definer_rls_context'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '072_security_definer_rls_context', applied_at FROM app.schema_migrations WHERE version = '067_security_definer_rls_context' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '072_security_definer_rls_context') AS already_applied \gset
\if :already_applied
  \echo '072_security_definer_rls_context ya aplicada'
\else
  -- SECURITY DEFINER RBAC/audit routines run as nexodocs_security. FORCE RLS
  -- applies to that role too, so give it only the actor and current-tenant rows
  -- needed to validate an authenticated context and its permissions.
  CREATE POLICY users_security_actor_context ON public.users
    FOR SELECT TO nexodocs_security
    USING (id = app.current_user_id());

  CREATE POLICY roles_security_tenant_context ON public.roles
    FOR SELECT TO nexodocs_security
    USING (tenant_id = app.current_tenant_id());
  CREATE POLICY user_roles_security_tenant_context ON public.user_roles
    FOR SELECT TO nexodocs_security
    USING (tenant_id = app.current_tenant_id());
  CREATE POLICY role_permissions_security_tenant_context ON public.role_permissions
    FOR SELECT TO nexodocs_security
    USING (tenant_id = app.current_tenant_id());

  INSERT INTO app.schema_migrations(version) VALUES ('072_security_definer_rls_context');
\endif
COMMIT;
