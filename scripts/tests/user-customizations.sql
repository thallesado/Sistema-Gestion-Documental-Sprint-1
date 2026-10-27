\set ON_ERROR_STOP on
BEGIN;
-- Regresión de 060_user_customizations: un perfil con user:customize (sin user:update) personaliza a
-- otro usuario solo en perfil y preferencias; uno sin el permiso no lee ni escribe la personalización ajena.
DO $$
DECLARE
  v_admin uuid;
  v_tenant uuid;
  v_target uuid;
  v_plain uuid;
  v_rows int;
BEGIN
  SELECT u.id, u.tenant_id INTO v_admin, v_tenant
  FROM public.users u
  JOIN public.user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
  JOIN public.role_permissions rp ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id AND p.code = 'user:customize'
  WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE'
  LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE NOTICE 'No user holds user:customize; skipping';
    RETURN;
  END IF;
  SELECT id INTO v_target FROM public.users
  WHERE tenant_id = v_tenant AND id <> v_admin AND deleted_at IS NULL LIMIT 1;
  IF v_target IS NULL THEN
    RAISE NOTICE 'Fixture tenant has a single user; skipping';
    RETURN;
  END IF;

  PERFORM set_config('app.tenant_id', v_tenant::text, true);
  PERFORM set_config('app.user_id', v_admin::text, true);
  SET LOCAL ROLE nexodocs_app;

  INSERT INTO public.user_customizations (tenant_id, user_id, job_title, max_upload_mb, updated_by)
  VALUES (v_tenant, v_target, 'Archivista', 5, v_admin)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET job_title = EXCLUDED.job_title;
  IF (SELECT count(*) FROM public.user_customizations WHERE user_id = v_target) <> 1 THEN
    RAISE EXCEPTION 'user:customize could not write the customization';
  END IF;
  PERFORM app.user_storage_bytes(v_target);

  BEGIN
    INSERT INTO public.user_customizations (tenant_id, user_id, max_upload_mb) VALUES (v_tenant, v_admin, 99);
    RAISE EXCEPTION 'max_upload_mb above 25 must be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF NOT app.has_permission('user:update') THEN
    UPDATE public.users SET phone = '+000', push_notifications = false WHERE id = v_target;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'user:customize could not update profile preferences (rows=%)', v_rows;
    END IF;
    BEGIN
      UPDATE public.users SET email = 'changed@example.invalid' WHERE id = v_target;
      RAISE EXCEPTION 'user:customize without user:update must not change account data';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;
  RESET ROLE;

  -- A user without user:customize only sees their own row.
  SELECT u.id INTO v_plain FROM public.users u
  WHERE u.tenant_id = v_tenant AND u.deleted_at IS NULL AND u.status = 'ACTIVE' AND u.id <> v_target
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id AND p.code IN ('user:customize', 'user:update')
      WHERE ur.tenant_id = u.tenant_id AND ur.user_id = u.id)
  LIMIT 1;
  IF v_plain IS NOT NULL THEN
    PERFORM set_config('app.user_id', v_plain::text, true);
    SET LOCAL ROLE nexodocs_app;
    IF EXISTS (SELECT 1 FROM public.user_customizations WHERE user_id = v_target) THEN
      RAISE EXCEPTION 'A user without user:customize read another user''s customization';
    END IF;
    IF app.user_storage_bytes(v_target) <> 0 THEN
      RAISE EXCEPTION 'user_storage_bytes leaked another user''s usage';
    END IF;
    UPDATE public.user_customizations SET job_title = 'x' WHERE user_id = v_target;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN
      RAISE EXCEPTION 'A user without user:customize modified a customization (rows=%)', v_rows;
    END IF;
    RESET ROLE;
  END IF;
END $$;
ROLLBACK;
