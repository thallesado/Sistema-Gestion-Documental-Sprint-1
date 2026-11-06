\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('070_secure_tenant_onboarding'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '070_secure_tenant_onboarding', applied_at FROM app.schema_migrations WHERE version = '065_secure_tenant_onboarding' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '070_secure_tenant_onboarding') AS already_applied \gset
\if :already_applied
  \echo '070_secure_tenant_onboarding ya aplicada'
\else
  CREATE OR REPLACE FUNCTION app.create_public_tenant_onboarding(
    p_tenant_id uuid, p_name text, p_code text, p_slug text, p_email text,
    p_plan_id uuid, p_trial_start timestamptz, p_trial_end timestamptz,
    p_admin_id uuid, p_username text, p_admin_email text, p_password_hash text,
    p_first_name text, p_last_name text, p_permission_ids bigint[]
  ) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp
  AS $$
  DECLARE new_role_id bigint;
  BEGIN
    IF p_tenant_id IS NULL OR p_admin_id IS NULL OR p_trial_end <= p_trial_start
       OR p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
      RAISE EXCEPTION 'Datos de alta inválidos' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
    INSERT INTO public.tenants (
      id, plan_id, name, code, slug, email, primary_color, subscription_status,
      trial_start_at, trial_ends_at, billing_cycle_v2, currency, timezone,
      date_format, default_language
    ) VALUES (
      p_tenant_id, p_plan_id, left(trim(p_name),150), left(trim(p_code),50),
      left(trim(p_slug),80), left(lower(trim(p_email)),150), '#087f7b',
      'TRIAL', p_trial_start, p_trial_end, 'MONTHLY', 'USD',
      'America/La_Paz', 'YYYY-MM-DD', 'es'
    );

    INSERT INTO public.users (
      id, tenant_id, username, email, password_hash, first_name, last_name,
      status, is_platform_admin, preferred_language, must_change_password
    ) VALUES (
      p_admin_id, p_tenant_id, left(trim(p_username),80),
      left(lower(trim(p_admin_email)),150), p_password_hash,
      left(trim(p_first_name),100), left(trim(p_last_name),100),
      'ACTIVE', false, 'es', false
    );

    PERFORM set_config('app.user_id', p_admin_id::text, true);
    INSERT INTO public.roles (tenant_id, name, description, is_system, is_active)
    VALUES (p_tenant_id, 'Administrador de tenant',
            'Administrador inicial creado durante el alta de la organización', true, true)
    RETURNING id INTO new_role_id;

    INSERT INTO public.user_roles (tenant_id, user_id, role_id)
    VALUES (p_tenant_id, p_admin_id, new_role_id);

    INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
    SELECT p_tenant_id, new_role_id, p.id
    FROM public.permissions p
    WHERE p.is_active AND p.id = ANY(COALESCE(p_permission_ids, ARRAY[]::bigint[]))
    ON CONFLICT DO NOTHING;

    RETURN new_role_id;
  END;
  $$;
  ALTER FUNCTION app.create_public_tenant_onboarding(
    uuid,text,text,text,text,uuid,timestamptz,timestamptz,uuid,text,text,text,text,text,bigint[]
  ) OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.create_public_tenant_onboarding(
    uuid,text,text,text,text,uuid,timestamptz,timestamptz,uuid,text,text,text,text,text,bigint[]
  ) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.create_public_tenant_onboarding(
    uuid,text,text,text,text,uuid,timestamptz,timestamptz,uuid,text,text,text,text,text,bigint[]
  ) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('070_secure_tenant_onboarding');
\endif
COMMIT;
