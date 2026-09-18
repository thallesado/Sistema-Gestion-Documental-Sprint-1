\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 12);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '012_http_access_audit'
) AS already_applied \gset

\if :already_applied
  \echo '012_http_access_audit ya aplicada'
\else
  CREATE FUNCTION app.record_http_access(
    p_action text,
    p_entity_type text,
    p_entity_id uuid,
    p_result text,
    p_ip_address inet,
    p_user_agent text,
    p_details jsonb DEFAULT '{}'::jsonb
  ) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  BEGIN
    IF NOT app.context_is_valid() THEN
      RAISE EXCEPTION 'Contexto autenticado inválido' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.audit_events(
      tenant_id, user_id, action, entity_type, entity_id,
      result, ip_address, user_agent, details
    ) VALUES (
      app.current_tenant_id(), app.current_user_id(),
      left(p_action, 80), left(p_entity_type, 60), p_entity_id,
      left(p_result, 30), p_ip_address, left(p_user_agent, 1000),
      COALESCE(p_details, '{}'::jsonb)
    );
  END;
  $$;

  ALTER FUNCTION app.record_http_access(text,text,uuid,text,inet,text,jsonb)
    OWNER TO nexodocs_security;
  GRANT INSERT ON audit_events TO nexodocs_security;
  GRANT USAGE ON SEQUENCE audit_events_id_seq TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.record_http_access(text,text,uuid,text,inet,text,jsonb) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_http_access(text,text,uuid,text,inet,text,jsonb)
    TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('012_http_access_audit');
\endif
COMMIT;
