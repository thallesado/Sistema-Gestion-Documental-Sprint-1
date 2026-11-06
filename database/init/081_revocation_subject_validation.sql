\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('081_revocation_subject_validation'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='081_revocation_subject_validation') AS already_applied \gset
\if :already_applied
  \echo '081_revocation_subject_validation ya aplicada'
\else
  -- The trigger must validate whether a revoked-token subject is a tenant or
  -- global platform identity before app.current_user_id() exists. The
  -- non-login BYPASSRLS owner is limited to this trigger function; the app
  -- role cannot assume it or invoke the function directly.
  ALTER FUNCTION app.validate_revoked_access_token_scope() OWNER TO nexodocs_platform_admin;
  REVOKE ALL ON FUNCTION app.validate_revoked_access_token_scope() FROM PUBLIC;
  INSERT INTO app.schema_migrations(version) VALUES ('081_revocation_subject_validation');
\endif
COMMIT;
