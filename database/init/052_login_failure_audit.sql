\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 52);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '052_login_failure_audit') AS already_applied \gset
\if :already_applied
  \echo '052_login_failure_audit ya aplicada'
\else
  CREATE OR REPLACE FUNCTION app.record_failed_authentication(
    p_tenant_id uuid,
    p_attempted_identifier text,
    p_ip_address inet,
    p_user_agent text
  ) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  DECLARE scoped_tenant uuid;
  BEGIN
    IF p_tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
      scoped_tenant := p_tenant_id;
    END IF;
    INSERT INTO public.audit_events(
      tenant_id, action, entity_type, result, ip_address, user_agent, details
    ) VALUES (
      scoped_tenant,
      'LOGIN_FAILED',
      'AUTHENTICATION',
      'FAILURE',
      p_ip_address,
      left(COALESCE(p_user_agent, ''), 1000),
      jsonb_build_object('attemptedIdentifier', left(COALESCE(p_attempted_identifier, ''), 150))
    );
  END;
  $$;
  ALTER FUNCTION app.record_failed_authentication(uuid, text, inet, text) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.record_failed_authentication(uuid, text, inet, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_failed_authentication(uuid, text, inet, text)
    TO nexodocs_app, nexodocs_platform_admin;
  GRANT INSERT ON public.audit_events TO nexodocs_security;
  GRANT USAGE ON SEQUENCE public.audit_events_id_seq TO nexodocs_security;

  INSERT INTO app.schema_migrations(version) VALUES ('052_login_failure_audit');
\endif
COMMIT;
