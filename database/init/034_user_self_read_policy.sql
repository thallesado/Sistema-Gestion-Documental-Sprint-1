\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 34);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '034_user_self_read_policy'
) AS already_applied \gset

\if :already_applied
  \echo '034_user_self_read_policy ya aplicada'
\else
  -- Permite que cualquier usuario autenticado consulte su propio registro en users (/auth/me),
  -- o usuarios con el permiso 'user:read' para listados administrativos.
  DROP POLICY IF EXISTS rbac_select ON public.users;
  CREATE POLICY rbac_select ON public.users FOR SELECT TO nexodocs_app
    USING ((id = (SELECT app.current_user_id())) OR (SELECT app.has_permission('user:read')));

  INSERT INTO app.schema_migrations(version) VALUES ('034_user_self_read_policy');
  \echo '034_user_self_read_policy aplicada exitosamente'
\endif

COMMIT;
