\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 5);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '006_password_recovery'
) AS already_applied \gset

\if :already_applied
  \echo '006_password_recovery ya aplicada'
\else
  CREATE TABLE password_recovery_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT password_recovery_user_fk
      FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE INDEX password_recovery_active_token_idx
    ON password_recovery_requests (token_hash)
    WHERE used_at IS NULL;

  REVOKE ALL ON password_recovery_requests FROM PUBLIC;
  GRANT SELECT, INSERT, UPDATE ON password_recovery_requests TO nexodocs_app;
  INSERT INTO app.schema_migrations(version) VALUES ('006_password_recovery');
\endif
COMMIT;
