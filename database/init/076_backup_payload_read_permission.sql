\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('076_backup_payload_read_permission'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '076_backup_payload_read_permission', applied_at FROM app.schema_migrations WHERE version = '071_backup_payload_read_permission' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '076_backup_payload_read_permission'
) AS already_applied \gset
\if :already_applied
  \echo '076_backup_payload_read_permission ya aplicada'
\else
  -- La RLS de tenant_backups sigue limitando las filas al tenant autenticado.
  -- El permiso de columna permite validar el snapshot guardado antes de restaurarlo.
  GRANT SELECT (payload) ON public.tenant_backups TO nexodocs_app;
  INSERT INTO app.schema_migrations(version)
  VALUES ('076_backup_payload_read_permission');
\endif
COMMIT;
