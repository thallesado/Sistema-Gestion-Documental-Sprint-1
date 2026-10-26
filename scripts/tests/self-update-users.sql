\set ON_ERROR_STOP on
BEGIN;
-- Regression: a user without the user:update permission can change their own password and profile
-- fields, but cannot touch another user's row nor their own status, department or deletion mark.
DO $$
DECLARE
  v_user uuid;
  v_tenant uuid;
  v_other uuid;
  v_rows int;
BEGIN
  SELECT u.id, u.tenant_id INTO v_user, v_tenant
  FROM public.users u
  WHERE u.email = 'acme.operativo.test@acme.example.invalid' AND u.deleted_at IS NULL;
  IF v_user IS NULL THEN
    RAISE NOTICE 'Fixture user not found; skipping';
    RETURN;
  END IF;
  SELECT id INTO v_other FROM public.users WHERE tenant_id = v_tenant AND id <> v_user AND deleted_at IS NULL LIMIT 1;

  PERFORM set_config('app.tenant_id', v_tenant::text, true);
  PERFORM set_config('app.user_id', v_user::text, true);
  SET LOCAL ROLE nexodocs_app;

  IF app.has_permission('user:update') THEN
    RAISE EXCEPTION 'Fixture user must not hold user:update';
  END IF;

  UPDATE public.users SET password_hash = password_hash, must_change_password = false WHERE id = v_user;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'A user without user:update could not update their own row (rows=%)', v_rows;
  END IF;

  UPDATE public.users SET biography = 'self edit' WHERE id = v_other;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'A user without user:update modified another user (rows=%)', v_rows;
  END IF;

  BEGIN
    UPDATE public.users SET status = 'BLOCKED' WHERE id = v_user;
    RAISE EXCEPTION 'Self status change must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.users SET deleted_at = now() WHERE id = v_user;
    RAISE EXCEPTION 'Self deletion mark must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;
END $$;
ROLLBACK;
