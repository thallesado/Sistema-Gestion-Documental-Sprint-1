\set ON_ERROR_STOP on
BEGIN;
-- Regresión de 063_plan_catalog: un solo precio vigente por plan y ciclo, versión inicial igual al
-- catálogo, y nexodocs_app sin acceso a precios ni plantillas de grupos.
DO $$
DECLARE
  v_plan uuid;
  v_user uuid;
  v_tenant uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.plans p
    JOIN public.plan_prices pp ON pp.plan_id = p.id AND pp.archived_at IS NULL
    WHERE pp.amount_usd <> CASE pp.billing_cycle WHEN 'ANNUAL' THEN p.price_yearly ELSE p.price_monthly END) THEN
    RAISE EXCEPTION 'The current price version must match plans.price_monthly/price_yearly';
  END IF;

  SELECT id INTO v_plan FROM public.plans LIMIT 1;
  BEGIN
    INSERT INTO public.plan_prices (plan_id, billing_cycle, amount_usd) VALUES (v_plan, 'MONTHLY', 1);
    RAISE EXCEPTION 'Two current prices for the same plan and cycle must be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.plan_prices (plan_id, billing_cycle, amount_usd, stripe_price_id, archived_at)
    VALUES (v_plan, 'MONTHLY', 1, 'prod_invalid', now());
    RAISE EXCEPTION 'A non price_ Stripe id must be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.default_role_templates (name) VALUES ('Administrador de tenant');
    RAISE EXCEPTION 'A template cannot replace the tenant administrator group';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  SELECT id, tenant_id INTO v_user, v_tenant FROM public.users
  WHERE tenant_id IS NOT NULL AND deleted_at IS NULL AND status = 'ACTIVE' LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM set_config('app.tenant_id', v_tenant::text, true);
    PERFORM set_config('app.user_id', v_user::text, true);
    SET LOCAL ROLE nexodocs_app;
    BEGIN
      PERFORM 1 FROM public.plan_prices LIMIT 1;
      RAISE EXCEPTION 'nexodocs_app must not read plan_prices';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    BEGIN
      PERFORM 1 FROM public.default_role_templates LIMIT 1;
      RAISE EXCEPTION 'nexodocs_app must not read default_role_templates';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    RESET ROLE;
  END IF;
END $$;
ROLLBACK;
\echo 'plan-catalog.sql OK'
