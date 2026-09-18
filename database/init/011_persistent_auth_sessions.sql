\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 11);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '011_persistent_auth_sessions'
) AS already_applied \gset

\if :already_applied
  \echo '011_persistent_auth_sessions ya aplicada'
\else
  CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    tenant_id uuid REFERENCES tenants(id),
    refresh_token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    replaced_by uuid REFERENCES auth_sessions(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    CONSTRAINT ck_auth_session_expiry CHECK (expires_at > created_at)
  );

  CREATE INDEX idx_auth_sessions_user_active
    ON auth_sessions(user_id, expires_at)
    WHERE revoked_at IS NULL;

  REVOKE ALL ON auth_sessions FROM PUBLIC;
  GRANT SELECT, INSERT, UPDATE ON auth_sessions TO nexodocs_app;

  INSERT INTO app.schema_migrations(version)
    VALUES ('011_persistent_auth_sessions');
\endif
COMMIT;
