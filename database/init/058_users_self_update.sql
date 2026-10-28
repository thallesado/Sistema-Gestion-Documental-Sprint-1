\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 58);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '058_users_self_update') AS already_applied \gset
\if :already_applied
  \echo '058_users_self_update ya aplicada'
\else
  -- rbac_update on users only allows rows to users holding user:update, so everybody else got
  -- "0 rows updated" (reported as an optimistic-lock conflict) when changing their own password or
  -- profile. Add a narrow self-update policy; row scope is the user's own id and tenant context.
  DROP POLICY IF EXISTS self_update ON public.users;
  CREATE POLICY self_update ON public.users FOR UPDATE TO nexodocs_app
    USING (id = (SELECT app.current_user_id()))
    WITH CHECK (id = (SELECT app.current_user_id()));

  -- Column grants are broader than what a regular user may change about themselves. Without
  -- user:update the application role cannot alter its own status, department, deletion mark or
  -- username; those remain administrative changes.
  CREATE OR REPLACE FUNCTION app.guard_users_self_update() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public, app, pg_temp AS $$
  BEGIN
    IF current_user = 'nexodocs_app'
       AND NOT app.has_permission('user:update')
       AND (NEW.status IS DISTINCT FROM OLD.status
            OR NEW.department_id IS DISTINCT FROM OLD.department_id
            OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
            OR NEW.username IS DISTINCT FROM OLD.username) THEN
      RAISE EXCEPTION 'Changing status, department, username or deletion mark requires user:update'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS users_guard_self_update ON public.users;
  CREATE TRIGGER users_guard_self_update BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION app.guard_users_self_update();

  INSERT INTO app.schema_migrations(version) VALUES ('058_users_self_update');
\endif
COMMIT;
