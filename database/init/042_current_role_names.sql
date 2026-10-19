\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 42);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '042_current_role_names'
) AS already_applied \gset

\if :already_applied
  \echo '042_current_role_names ya aplicada'
\else
  -- roles y user_roles solo son legibles con role:read (rbac_select). Un perfil sin ese
  -- permiso (p. ej. "Médico Especialista") recibía roleNames vacío en /auth/me y la web
  -- mostraba "Usuario básico". Igual que app.current_role_ids() (040), la función solo
  -- devuelve los grupos activos del usuario del contexto y nunca los de otros usuarios.
  CREATE OR REPLACE FUNCTION app.current_role_names() RETURNS SETOF text
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
    SELECT r.name::text
    FROM public.user_roles ur
    JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
    WHERE app.context_is_valid()
      AND ur.tenant_id = app.current_tenant_id()
      AND ur.user_id = app.current_user_id()
  $$;
  ALTER FUNCTION app.current_role_names() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.current_role_names() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.current_role_names() TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('042_current_role_names');
  \echo '042_current_role_names aplicada exitosamente'
\endif

COMMIT;
