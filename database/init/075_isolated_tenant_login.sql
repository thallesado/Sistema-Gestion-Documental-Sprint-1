\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('075_isolated_tenant_login'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '075_isolated_tenant_login', applied_at FROM app.schema_migrations WHERE version = '070_isolated_tenant_login' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '075_isolated_tenant_login') AS already_applied \gset
\if :already_applied
  \echo '075_isolated_tenant_login ya aplicada'
\else
  -- Only the non-login security owner can see credential rows. The callable function
  -- returns exactly one identifier match from the tenant database selected server-side.
  GRANT SELECT (id, tenant_id, username, email, password_hash, first_name, last_name,
                status, deleted_at, is_platform_admin, preferred_language, must_change_password)
    ON public.users TO nexodocs_security;
  CREATE POLICY users_security_tenant_login ON public.users
    FOR SELECT TO nexodocs_security
    USING (tenant_id = app.current_tenant_id());

  CREATE OR REPLACE FUNCTION app.lookup_tenant_login(
    p_tenant_id uuid, p_identifier text
  ) RETURNS TABLE (
    id uuid, tenant_id uuid, username varchar, email varchar, password_hash varchar,
    first_name varchar, last_name varchar, status public.user_status,
    deleted_at timestamptz, is_platform_admin boolean, preferred_language varchar,
    must_change_password boolean
  ) LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
  DECLARE matched_user_id uuid;
  BEGIN
    IF p_tenant_id IS NULL OR p_identifier IS NULL OR length(p_identifier) > 150 THEN
      RETURN;
    END IF;
    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
    SELECT u.id INTO matched_user_id
      FROM public.users u
     WHERE u.tenant_id = p_tenant_id
       AND (lower(u.username) = lower(p_identifier) OR lower(u.email) = lower(p_identifier))
     ORDER BY u.id
     LIMIT 1;
    IF matched_user_id IS NULL THEN RETURN; END IF;
    PERFORM set_config('app.user_id', matched_user_id::text, true);
    RETURN QUERY
      SELECT u.id, u.tenant_id, u.username, u.email, u.password_hash,
             u.first_name, u.last_name, u.status, u.deleted_at,
             u.is_platform_admin, u.preferred_language, u.must_change_password
        FROM public.users u WHERE u.id = matched_user_id AND u.tenant_id = p_tenant_id;
  END;
  $$;
  ALTER FUNCTION app.lookup_tenant_login(uuid, text) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.lookup_tenant_login(uuid, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.lookup_tenant_login(uuid, text) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('075_isolated_tenant_login');
\endif
COMMIT;
