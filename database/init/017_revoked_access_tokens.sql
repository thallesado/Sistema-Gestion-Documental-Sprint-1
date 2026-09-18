\set ON_ERROR_STOP on
-- Lista de revocación para access tokens. Nunca almacena el bearer token:
-- token_hash es exclusivamente su representación SHA-256 hexadecimal.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 17);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app.schema_migrations FROM PUBLIC, nexodocs_app;

SELECT EXISTS (
  SELECT 1
  FROM app.schema_migrations
  WHERE version = '017_revoked_access_tokens'
) AS already_applied \gset

\if :already_applied
  \echo '017_revoked_access_tokens ya aplicada'
\else
  CREATE TABLE revoked_access_tokens (
    token_hash varchar(64) NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_revoked_access_tokens PRIMARY KEY (token_hash),
    CONSTRAINT fk_revoked_access_tokens_user
      FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_revoked_access_tokens_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT ck_revoked_access_tokens_token_hash_sha256
      CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_revoked_access_tokens_expiry
      CHECK (expires_at > revoked_at)
  );

  -- La clave primaria resuelve la búsqueda exacta del filtro de seguridad.
  -- Este índice permite eliminar eficientemente revocaciones ya vencidas.
  CREATE INDEX idx_revoked_access_tokens_expiry
    ON revoked_access_tokens(expires_at);

  -- La lista debe permanecer consultable por el filtro de seguridad incluso
  -- antes de establecer contexto RLS. Por ello esta tabla deliberadamente no
  -- habilita RLS; el hash nunca revela el bearer token.
  ALTER TABLE revoked_access_tokens DISABLE ROW LEVEL SECURITY;

  -- Una revocación de tenant debe corresponder a su usuario y una global solo
  -- a una identidad de plataforma. La FK simple asegura la existencia y esta
  -- validación cubre el caso nullable de los usuarios de plataforma.
  CREATE FUNCTION app.validate_revoked_access_token_scope()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
  AS $$
  DECLARE
    subject_tenant_id uuid;
    subject_is_platform_admin boolean;
  BEGIN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Las revocaciones de access token son inmutables'
        USING ERRCODE = '55000';
    END IF;

    SELECT u.tenant_id, u.is_platform_admin
      INTO subject_tenant_id, subject_is_platform_admin
      FROM public.users u
     WHERE u.id = NEW.user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe el usuario de la revocación'
        USING ERRCODE = '23503';
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM subject_tenant_id
       OR (NEW.tenant_id IS NULL AND NOT subject_is_platform_admin) THEN
      RAISE EXCEPTION 'El tenant de la revocación no corresponde al usuario'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END;
  $$;
  ALTER FUNCTION app.validate_revoked_access_token_scope()
    OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.validate_revoked_access_token_scope() FROM PUBLIC;

  CREATE FUNCTION app.delete_expired_revoked_access_token()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  BEGIN
    IF OLD.expires_at > statement_timestamp() THEN
      RAISE EXCEPTION 'Solo se pueden eliminar revocaciones vencidas'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END;
  $$;
  ALTER FUNCTION app.delete_expired_revoked_access_token()
    OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.delete_expired_revoked_access_token() FROM PUBLIC;

  CREATE TRIGGER trg_revoked_access_tokens_scope
    BEFORE INSERT OR UPDATE ON revoked_access_tokens
    FOR EACH ROW EXECUTE FUNCTION app.validate_revoked_access_token_scope();
  CREATE TRIGGER trg_revoked_access_tokens_delete_expired
    BEFORE DELETE ON revoked_access_tokens
    FOR EACH ROW EXECUTE FUNCTION app.delete_expired_revoked_access_token();

  -- Hibernate materializa la entidad al persistir una revocación; SELECT e
  -- INSERT son necesarios para ello y DELETE para la limpieza de expirados.
  -- UPDATE, DDL y privilegios administrativos permanecen revocados.
  REVOKE ALL ON revoked_access_tokens FROM PUBLIC, nexodocs_app;
  GRANT SELECT, INSERT, DELETE ON revoked_access_tokens TO nexodocs_app;

  INSERT INTO app.schema_migrations(version)
  VALUES ('017_revoked_access_tokens');
\endif
COMMIT;
