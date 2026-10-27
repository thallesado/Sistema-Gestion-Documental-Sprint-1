\set ON_ERROR_STOP on
BEGIN;
-- Regresión de 062_platform_audit: nexodocs_app (contexto de cualquier tenant) no lee ni escribe la
-- auditoría de plataforma; ni el usuario de conexión puede editar o borrar una acción registrada,
-- y la base rechaza una acción sin motivo.
DO $$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_tenant uuid;
  v_user uuid;
  v_id bigint;
BEGIN
  SELECT id, username INTO v_actor, v_actor_name FROM public.users
  WHERE tenant_id IS NULL AND deleted_at IS NULL LIMIT 1;
  IF v_actor IS NULL THEN
    RAISE NOTICE 'No platform account; skipping';
    RETURN;
  END IF;
  SELECT id INTO v_tenant FROM public.tenants LIMIT 1;

  INSERT INTO public.platform_audit_events (actor_user_id, actor_username, action, tenant_id, reason, after_state)
  VALUES (v_actor, v_actor_name, 'TENANT_TRIAL_EXTENDED', v_tenant, 'Prueba de regresión', '{"days": 1}')
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.platform_audit_events (actor_user_id, actor_username, action, reason)
    VALUES (v_actor, v_actor_name, 'TENANT_SUSPENDED', '   ');
    RAISE EXCEPTION 'An action without a reason must be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.platform_audit_events SET reason = 'Motivo alterado' WHERE id = v_id;
    RAISE EXCEPTION 'platform_audit_events must be immutable (UPDATE)';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN -- app.block_mutation (004): ERRCODE 55000
    NULL;
  END;

  BEGIN
    DELETE FROM public.platform_audit_events WHERE id = v_id;
    RAISE EXCEPTION 'platform_audit_events must be immutable (DELETE)';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN -- app.block_mutation (004): ERRCODE 55000
    NULL;
  END;

  -- Un usuario de tenant con contexto válido no tiene privilegios sobre la tabla.
  SELECT id, tenant_id INTO v_user, v_tenant FROM public.users
  WHERE tenant_id IS NOT NULL AND deleted_at IS NULL AND status = 'ACTIVE' LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM set_config('app.tenant_id', v_tenant::text, true);
    PERFORM set_config('app.user_id', v_user::text, true);
    SET LOCAL ROLE nexodocs_app;
    BEGIN
      PERFORM 1 FROM public.platform_audit_events LIMIT 1;
      RAISE EXCEPTION 'nexodocs_app must not read platform_audit_events';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    BEGIN
      INSERT INTO public.platform_audit_events (actor_user_id, actor_username, action, reason)
      VALUES (v_user, 'tenant-user', 'TENANT_SUSPENDED', 'Intento desde un tenant');
      RAISE EXCEPTION 'nexodocs_app must not write platform_audit_events';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    RESET ROLE;
  END IF;
END $$;
ROLLBACK;
\echo 'platform-audit.sql OK'
