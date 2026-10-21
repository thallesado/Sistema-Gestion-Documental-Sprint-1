\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 51);
SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '051_user_profile_select_privileges'
) AS already_applied \gset
\if :already_applied
  \echo '051_user_profile_select_privileges ya aplicada'
\else
  -- Migration 046 added these mapped fields but only granted UPDATE.
  -- Hibernate reads both when loading /auth/me. Keep column grants and RLS.
  GRANT SELECT (preferred_language, must_change_password) ON public.users TO nexodocs_app;
  INSERT INTO app.schema_migrations(version) VALUES ('051_user_profile_select_privileges');
\endif
COMMIT;
