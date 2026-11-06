\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 87);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='087_secure_recovery_tenant_scope') AS already_applied \gset
\if :already_applied
  \echo '087_secure_recovery_tenant_scope ya aplicada'
\else
  ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.auth_sessions FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS auth_sessions_self_read ON public.auth_sessions;
  CREATE POLICY auth_sessions_self_read ON public.auth_sessions
    FOR SELECT TO nexodocs_app
    USING (tenant_id IS NOT DISTINCT FROM app.current_tenant_id()
       AND (user_id = app.current_user_id() OR app.has_permission('user:update')));
  DROP POLICY IF EXISTS auth_sessions_self_insert ON public.auth_sessions;
  CREATE POLICY auth_sessions_self_insert ON public.auth_sessions
    FOR INSERT TO nexodocs_app
    WITH CHECK (tenant_id IS NOT DISTINCT FROM app.current_tenant_id() AND user_id = app.current_user_id());
  DROP POLICY IF EXISTS auth_sessions_scoped_update ON public.auth_sessions;
  CREATE POLICY auth_sessions_scoped_update ON public.auth_sessions
    FOR UPDATE TO nexodocs_app
    USING (tenant_id IS NOT DISTINCT FROM app.current_tenant_id()
       AND (user_id = app.current_user_id() OR app.has_permission('user:update')))
    WITH CHECK (tenant_id IS NOT DISTINCT FROM app.current_tenant_id()
       AND (user_id = app.current_user_id() OR app.has_permission('user:update')));

  ALTER TABLE public.password_recovery_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.password_recovery_requests FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS password_recovery_app_scope ON public.password_recovery_requests;
  CREATE POLICY password_recovery_app_scope ON public.password_recovery_requests
    FOR ALL TO nexodocs_app
    USING (tenant_id = app.current_tenant_id() AND user_id = app.current_user_id())
    WITH CHECK (tenant_id = app.current_tenant_id() AND user_id = app.current_user_id());
  DROP POLICY IF EXISTS password_recovery_security_lookup ON public.password_recovery_requests;
  CREATE POLICY password_recovery_security_lookup ON public.password_recovery_requests
    FOR SELECT TO nexodocs_security
    USING (token_hash = current_setting('app.recovery_token_hash', true));
  DROP POLICY IF EXISTS password_recovery_security_lock ON public.password_recovery_requests;
  CREATE POLICY password_recovery_security_lock ON public.password_recovery_requests
    FOR UPDATE TO nexodocs_security
    USING (token_hash = current_setting('app.recovery_token_hash', true))
    WITH CHECK (token_hash = current_setting('app.recovery_token_hash', true));
  GRANT SELECT (id, user_id, tenant_id, token_hash, expires_at, used_at, created_at)
    ON public.password_recovery_requests TO nexodocs_security;
  GRANT UPDATE (id) ON public.password_recovery_requests TO nexodocs_security;

  CREATE OR REPLACE FUNCTION app.lookup_password_recovery(p_token_hash text)
  RETURNS TABLE(id uuid, user_id uuid, tenant_id uuid, token_hash varchar,
                expires_at timestamptz, used_at timestamptz, created_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
  DECLARE found_user uuid; found_tenant uuid;
  BEGIN
    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
    PERFORM set_config('app.recovery_token_hash', p_token_hash, true);
    SELECT r.user_id, r.tenant_id INTO found_user, found_tenant
      FROM public.password_recovery_requests r WHERE r.token_hash=p_token_hash
      FOR UPDATE;
    IF found_user IS NULL OR found_tenant IS NULL THEN RETURN; END IF;
    PERFORM set_config('app.tenant_id', found_tenant::text, true);
    PERFORM set_config('app.user_id', found_user::text, true);
    RETURN QUERY SELECT r.id, r.user_id, r.tenant_id, r.token_hash,
                        r.expires_at, r.used_at, r.created_at
      FROM public.password_recovery_requests r
      WHERE r.token_hash=p_token_hash AND r.user_id=found_user AND r.tenant_id=found_tenant;
  END;
  $$;
  ALTER FUNCTION app.lookup_password_recovery(text) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.lookup_password_recovery(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.lookup_password_recovery(text) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('087_secure_recovery_tenant_scope');
\endif
COMMIT;
