\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 16);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (
    SELECT 1 FROM app.schema_migrations
    WHERE version = '016_finocode_tenant_name'
) AS already_applied \gset
\if :already_applied
  \echo '016_finocode_tenant_name ya aplicada'
\else
  -- El UUID, código, slug y todas las relaciones permanecen intactos.
  UPDATE tenants
  SET name = 'FinoCode',
      updated_at = now()
  WHERE id = '20000000-0000-0000-0000-000000000001'
    AND name <> 'FinoCode';

  -- La identidad tenant_id es inmutable por diseño. Por eso se crean
  -- identidades de plataforma separadas, conservando intactos los usuarios
  -- históricos del tenant y sus relaciones documentales.
  INSERT INTO users (
    tenant_id, username, email, password_hash, first_name, last_name,
    status, is_platform_admin
  )
  SELECT
    NULL,
    u.username,
    u.email,
    u.password_hash,
    u.first_name,
    u.last_name,
    u.status,
    true
  FROM users u
  WHERE u.tenant_id = '20000000-0000-0000-0000-000000000001'
    AND u.username IN (
      'andres.superadmin', 'edixon.superadmin', 'oscar.superadmin',
      'diego.superadmin', 'denilson.superadmin', 'mauricio.superadmin'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM users existing_platform
      WHERE existing_platform.tenant_id IS NULL
        AND existing_platform.username = u.username
    );

  INSERT INTO app.schema_migrations(version)
  VALUES ('016_finocode_tenant_name');
\endif
COMMIT;
