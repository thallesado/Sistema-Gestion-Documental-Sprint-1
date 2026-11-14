\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('077_backup_scheduler_schema_access'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '077_backup_scheduler_schema_access') AS already_applied \gset
\if :already_applied
  \echo '077_backup_scheduler_schema_access ya aplicada'
\else
  -- The runtime role may invoke narrowly scoped app functions; it does not receive
  -- table-wide access or RLS bypass from this schema grant.
  GRANT USAGE ON SCHEMA app TO nexodocs_app;
  SELECT to_regprocedure('app.backup_scheduler_actor(uuid,text)') IS NOT NULL AS scheduler_exists \gset
  \if :scheduler_exists
    GRANT EXECUTE ON FUNCTION app.backup_scheduler_actor(uuid,text) TO nexodocs_app;
  \endif
  INSERT INTO app.schema_migrations(version) VALUES ('077_backup_scheduler_schema_access');
\endif
COMMIT;
