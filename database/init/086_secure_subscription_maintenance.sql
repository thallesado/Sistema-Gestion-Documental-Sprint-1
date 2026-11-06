\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('086_secure_subscription_maintenance'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='086_secure_subscription_maintenance') AS already_applied \gset
\if :already_applied
  \echo '086_secure_subscription_maintenance ya aplicada'
\else
  -- Scheduled billing maintenance runs without a tenant request context. Keep
  -- table writes away from the login role and expose only these narrow routines.
  CREATE OR REPLACE FUNCTION app.finish_nonrenewed_subscriptions(p_retention_days integer)
  RETURNS TABLE(tenant_id uuid)
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp AS $$
  BEGIN
    IF p_retention_days IS NULL OR p_retention_days < 1 OR p_retention_days > 3650 THEN
      RAISE EXCEPTION 'Período de retención inválido' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
      UPDATE public.tenants t
      SET subscription_status = 'CANCELED', canceled_at = now(),
          cancellation_reason = coalesce(cancellation_reason, 'No renovada al terminar el período'),
          deletion_scheduled_at = now() + make_interval(days => p_retention_days),
          cancel_at_period_end = false
      WHERE t.cancel_at_period_end AND t.stripe_subscription_id IS NULL
        AND t.current_period_end <= now()
        AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
      RETURNING t.id;
  END;
  $$;
  ALTER FUNCTION app.finish_nonrenewed_subscriptions(integer) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.finish_nonrenewed_subscriptions(integer) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.finish_nonrenewed_subscriptions(integer) TO nexodocs_app;

  CREATE OR REPLACE FUNCTION app.apply_scheduled_subscription_changes()
  RETURNS TABLE(tenant_id uuid, plan_id uuid)
  LANGUAGE sql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp AS $$
    UPDATE public.tenants t
    SET plan_id = t.scheduled_plan_id,
        billing_cycle_v2 = coalesce(t.scheduled_billing_cycle, t.billing_cycle_v2),
        scheduled_plan_id = NULL, scheduled_billing_cycle = NULL, scheduled_change_at = NULL
    WHERE t.stripe_subscription_id IS NULL AND t.scheduled_change_at <= now()
      AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
    RETURNING t.id, t.plan_id;
  $$;
  ALTER FUNCTION app.apply_scheduled_subscription_changes() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.apply_scheduled_subscription_changes() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.apply_scheduled_subscription_changes() TO nexodocs_app;

  CREATE OR REPLACE FUNCTION app.record_tenant_lifecycle_audit(
    p_tenant_id uuid, p_actor_id uuid, p_action text, p_details jsonb
  ) RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp AS $$
  BEGIN
    IF p_tenant_id IS NULL OR p_action NOT IN (
      'SUBSCRIPTION_UPGRADED','SUBSCRIPTION_CHANGE_SCHEDULED','SUBSCRIPTION_CHANGE_UNSCHEDULED',
      'SUBSCRIPTION_RENEWAL_RESUMED','SUBSCRIPTION_RENEWAL_STOPPED','SUBSCRIPTION_CANCELED',
      'SUBSCRIPTION_ENDED','SUBSCRIPTION_CHANGE_APPLIED'
    ) THEN
      RAISE EXCEPTION 'Evento de suscripción inválido' USING ERRCODE = '22023';
    END IF;
    IF p_actor_id IS NULL THEN
      IF p_action NOT IN ('SUBSCRIPTION_ENDED','SUBSCRIPTION_CHANGE_APPLIED')
         OR app.current_tenant_id() IS NOT NULL OR app.current_user_id() IS NOT NULL THEN
        RAISE EXCEPTION 'Contexto de sistema inválido' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF app.current_tenant_id() IS DISTINCT FROM p_tenant_id
         OR app.current_user_id() IS DISTINCT FROM p_actor_id
         OR NOT (app.has_permission('tenant:update') OR app.has_permission('tenant:manage')) THEN
        RAISE EXCEPTION 'Permiso de suscripción requerido' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
      RAISE EXCEPTION 'Organización no disponible' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.audit_events(tenant_id,user_id,action,entity_type,entity_id,result,details)
    VALUES (p_tenant_id,p_actor_id,p_action,'TENANT',p_tenant_id,'SUCCESS',coalesce(p_details,'{}'::jsonb));
    RETURN true;
  END;
  $$;
  ALTER FUNCTION app.record_tenant_lifecycle_audit(uuid,uuid,text,jsonb) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.record_tenant_lifecycle_audit(uuid,uuid,text,jsonb) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_tenant_lifecycle_audit(uuid,uuid,text,jsonb) TO nexodocs_app;

  -- Only the non-login security role may settle globally due add-ons. The app
  -- role retains its tenant-scoped read-only policy from migration 064.
  DROP POLICY IF EXISTS tenant_addons_security_maintenance ON public.tenant_addons;
  CREATE POLICY tenant_addons_security_maintenance ON public.tenant_addons
    FOR ALL TO nexodocs_security USING (true) WITH CHECK (true);
  GRANT SELECT, UPDATE ON public.tenant_addons TO nexodocs_security;

  CREATE OR REPLACE FUNCTION app.apply_due_tenant_addon_changes()
  RETURNS integer
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public, app, pg_temp AS $$
  DECLARE changed integer;
  DECLARE total_changed integer := 0;
  BEGIN
    UPDATE public.tenant_addons
    SET status = CASE WHEN pending_units = 0 THEN 'ENDED' ELSE status END,
        units = CASE WHEN pending_units > 0 THEN pending_units ELSE units END,
        pending_units = NULL, pending_at = NULL, updated_at = now()
    WHERE status = 'ACTIVE' AND pending_at <= now();
    GET DIAGNOSTICS changed = ROW_COUNT;
    total_changed := total_changed + changed;

    UPDATE public.tenant_addons
    SET status = 'EXPIRED', updated_at = now()
    WHERE status = 'ACTIVE' AND expires_at <= now();
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN total_changed + changed;
  END;
  $$;
  ALTER FUNCTION app.apply_due_tenant_addon_changes() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.apply_due_tenant_addon_changes() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.apply_due_tenant_addon_changes() TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('086_secure_subscription_maintenance');
\endif
COMMIT;
