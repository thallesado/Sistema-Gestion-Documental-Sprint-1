\set ON_ERROR_STOP on
-- Compatibilidad incremental para el backend Spring Boot.
-- El rol nexodocs_app necesita leer el hash para verificar el login. La entidad
-- JPA de User se materializa completa, por lo que /api/v1/auth/me también
-- selecciona password_hash aunque el DTO nunca lo devuelve.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 14);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app.schema_migrations FROM PUBLIC, nexodocs_app;

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '014_auth_user_password_hash_privilege'
) AS already_applied \gset

\if :already_applied
  \echo '014_auth_user_password_hash_privilege ya aplicada'
\else
  -- No se conceden privilegios de tabla completos: se mantiene el bloqueo de
  -- columnas administrativas como is_platform_admin. La política RLS sigue
  -- siendo la que limita las filas al usuario/tenant autenticado.
  GRANT SELECT (password_hash) ON users TO nexodocs_app;

  INSERT INTO app.schema_migrations(version)
    VALUES ('014_auth_user_password_hash_privilege');
\endif
COMMIT;
