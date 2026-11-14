\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('083_secure_platform_technical_logs'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='083_secure_platform_technical_logs') AS already_applied \gset
\if :already_applied
  \echo '083_secure_platform_technical_logs ya aplicada'
\else
  REVOKE ALL ON public.platform_technical_logs FROM PUBLIC, nexodocs_app, nexodocs_platform_admin;
  REVOKE ALL ON SEQUENCE public.platform_technical_logs_id_seq FROM PUBLIC, nexodocs_app, nexodocs_platform_admin;
  GRANT INSERT, SELECT ON public.platform_technical_logs TO nexodocs_platform_admin;
  GRANT USAGE, SELECT ON SEQUENCE public.platform_technical_logs_id_seq TO nexodocs_platform_admin;

  CREATE OR REPLACE FUNCTION app.record_platform_technical_log(
    p_level text, p_tenant_id uuid, p_actor_id uuid, p_category text, p_summary text,
    p_method text, p_path text, p_status integer, p_exception_type text
  ) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, app, public AS $$
  DECLARE actor_tenant uuid;
  BEGIN
    IF p_actor_id IS NOT NULL THEN
      SELECT u.tenant_id INTO actor_tenant FROM public.users u
      WHERE u.id=p_actor_id AND u.status='ACTIVE' AND u.deleted_at IS NULL;
      IF NOT FOUND OR p_tenant_id IS DISTINCT FROM actor_tenant THEN
        RAISE EXCEPTION 'Invalid technical log actor scope' USING ERRCODE = '42501';
      END IF;
    ELSIF p_tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Tenant-scoped logs require an authenticated actor' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.platform_technical_logs(level,tenant_id,actor_id,category,summary,request_method,request_path,http_status,exception_type)
    VALUES (p_level,p_tenant_id,p_actor_id,p_category,p_summary,p_method,p_path,p_status,p_exception_type);
    RETURN true;
  END;
  $$;
  ALTER FUNCTION app.record_platform_technical_log(text,uuid,uuid,text,text,text,text,integer,text) OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.record_platform_technical_log(text,uuid,uuid,text,text,text,text,integer,text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_platform_technical_log(text,uuid,uuid,text,text,text,text,integer,text) TO nexodocs_app;

  CREATE OR REPLACE FUNCTION app.list_platform_technical_logs(
    p_level text, p_tenant_id uuid, p_limit integer, p_offset bigint
  ) RETURNS TABLE(
    id bigint, occurred_at timestamptz, level text, tenant_id uuid, actor_id uuid,
    category text, summary text, request_method text, request_path text,
    http_status integer, exception_type text, total_count bigint
  ) LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, app, public AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = app.current_user_id() AND u.tenant_id IS NULL
        AND u.is_platform_admin AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT l.id,l.occurred_at,l.level,l.tenant_id,l.actor_id,l.category,l.summary,
           l.request_method,l.request_path,l.http_status,l.exception_type,
           count(*) OVER() AS total_count
    FROM public.platform_technical_logs l
    WHERE (p_level IS NULL OR l.level=p_level)
      AND (p_tenant_id IS NULL OR l.tenant_id=p_tenant_id)
    ORDER BY l.occurred_at DESC,l.id DESC
    LIMIT greatest(1,least(coalesce(p_limit,25),100))
    OFFSET greatest(coalesce(p_offset,0),0);
  END;
  $$;
  ALTER FUNCTION app.list_platform_technical_logs(text,uuid,integer,bigint) OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.list_platform_technical_logs(text,uuid,integer,bigint) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.list_platform_technical_logs(text,uuid,integer,bigint) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('083_secure_platform_technical_logs');
\endif
COMMIT;
