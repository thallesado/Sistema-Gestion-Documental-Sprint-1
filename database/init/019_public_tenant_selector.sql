\set ON_ERROR_STOP on
-- Selector público de organización del login/recuperación de contraseña.
-- tenants tiene RLS forzada (solo se ve el tenant del contexto) y antes de autenticarse
-- no hay contexto. En vez de abrir una política de lectura sobre la tabla, se expone una
-- función SECURITY DEFINER que devuelve únicamente id y name de organizaciones que
-- pueden iniciar sesión (TRIAL/ACTIVE). El resto de columnas sigue inaccesible.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 19);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '019_public_tenant_selector'
) AS already_applied \gset

\if :already_applied
  \echo '019_public_tenant_selector ya aplicada'
\else
  -- El propietario de la función (BYPASSRLS) solo necesita leer name además de id/estado.
  GRANT SELECT (name) ON public.tenants TO nexodocs_security;

  CREATE OR REPLACE FUNCTION app.list_login_tenants()
  RETURNS TABLE (id uuid, name text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp AS $$
    SELECT t.id, t.name::text
    FROM public.tenants t
    WHERE t.subscription_status IN ('TRIAL', 'ACTIVE')
    ORDER BY t.name
  $$;
  ALTER FUNCTION app.list_login_tenants() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.list_login_tenants() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.list_login_tenants() TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('019_public_tenant_selector');
\endif
COMMIT;
