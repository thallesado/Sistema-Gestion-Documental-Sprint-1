\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 41);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '041_user_profile_insert_grants'
) AS already_applied \gset

\if :already_applied
  \echo '041_user_profile_insert_grants ya aplicada'
\else
  -- 018_user_profile añadió estas columnas y concedió a nexodocs_app solo SELECT y UPDATE.
  -- Hibernate incluye todas las columnas mapeadas de User en el INSERT, por lo que crear
  -- usuarios desde POST /api/v1/users fallaba con "permission denied for table users".
  -- Se concede INSERT únicamente sobre esas columnas; el resto del modelo de 004 no cambia.
  GRANT INSERT (phone, biography, avatar_data, avatar_content_type, email_notifications, push_notifications)
    ON users TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('041_user_profile_insert_grants');
  \echo '041_user_profile_insert_grants aplicada exitosamente'
\endif

COMMIT;
