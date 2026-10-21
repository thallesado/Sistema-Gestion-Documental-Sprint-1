-- Perfil editable del usuario autenticado.
-- Las columnas se mantienen separadas de los datos de autenticación y la foto
-- se almacena como bytea para que no quede expuesta por una URL pública.
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 18);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS biography varchar(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data bytea;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_content_type varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications boolean NOT NULL DEFAULT true;

-- Versiones previas del prototipo podían crear avatar_data como OID por usar
-- @Lob. Se conserva cualquier foto existente al convertirla a bytea.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'avatar_data' AND udt_name = 'oid'
  ) THEN
    ALTER TABLE users ALTER COLUMN avatar_data TYPE bytea
      USING CASE WHEN avatar_data IS NULL THEN NULL ELSE lo_get(avatar_data) END;
  END IF;
END $$;

-- nexodocs_app opera con privilegios mínimos por columna; al agregar columnas
-- nuevas hay que concederlas explícitamente además de aplicar las políticas RLS.
GRANT SELECT (phone, biography, avatar_data, avatar_content_type) ON users TO nexodocs_app;
GRANT UPDATE (phone, biography, avatar_data, avatar_content_type) ON users TO nexodocs_app;
GRANT SELECT (email_notifications, push_notifications) ON users TO nexodocs_app;
GRANT UPDATE (email_notifications, push_notifications, password_hash) ON users TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES ('018_user_profile') ON CONFLICT DO NOTHING;
COMMIT;
