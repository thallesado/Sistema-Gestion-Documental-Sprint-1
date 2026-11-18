\set ON_ERROR_STOP on
BEGIN;
-- Regresión de 065_discounts: todo cupón termina, un tenant no ve los descuentos de otro ni puede
-- escribirlos, nexodocs_app no lee el catálogo de cupones y solo hay un descuento vigente por tenant.
DO $$
DECLARE
  v_a uuid; v_b uuid; v_user uuid; v_coupon uuid; v_code uuid;
  v_own uuid; v_other uuid; v_seen int;
BEGIN
  SELECT u.tenant_id, u.id INTO v_a, v_user FROM public.users u
  WHERE u.tenant_id IS NOT NULL AND u.deleted_at IS NULL AND u.status = 'ACTIVE' LIMIT 1;
  SELECT id INTO v_b FROM public.tenants WHERE id <> v_a LIMIT 1;
  IF v_user IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'Need two tenants and an active user; skipping';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.coupons (code, name, percent_off, duration, plan_codes, redeem_by)
    VALUES ('SIN-FIN', 'Sin fin', 10, 'FOREVER', ARRAY['PRO'], now() + interval '1 month');
    RAISE EXCEPTION 'A coupon without end (FOREVER) must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.coupons (code, name, percent_off, duration, plan_codes) VALUES ('SIN-FECHA', 'Sin fecha', 10, 'ONCE', ARRAY['PRO']);
    RAISE EXCEPTION 'A coupon without redeem_by must be rejected';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.coupons (code, name, percent_off, amount_off_usd, duration, plan_codes, redeem_by)
    VALUES ('DOBLE', 'Doble', 10, 5, 'ONCE', ARRAY['PRO'], now() + interval '1 month');
    RAISE EXCEPTION 'A coupon with percent and amount must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.coupons (code, name, percent_off, duration, duration_in_months, plan_codes, redeem_by)
  VALUES ('REGRESION-20', 'Prueba de regresión', 20, 'REPEATING', 3, ARRAY['PRO'], now() + interval '1 month')
  RETURNING id INTO v_coupon;
  INSERT INTO public.promotion_codes (coupon_id, code, expires_at) VALUES (v_coupon, 'REGRESION2026', now() + interval '1 month')
  RETURNING id INTO v_code;

  BEGIN
    INSERT INTO public.tenant_discounts (tenant_id, coupon_id, source, ends_at)
    VALUES (v_a, v_coupon, 'LOYALTY', now() + interval '3 months');
    RAISE EXCEPTION 'A platform discount without reason and approver must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.tenant_discounts (tenant_id, coupon_id, promotion_code_id, source, ends_at)
  VALUES (v_a, v_coupon, v_code, 'PROMOTION_CODE', now() + interval '3 months') RETURNING id INTO v_own;
  INSERT INTO public.tenant_discounts (tenant_id, coupon_id, promotion_code_id, source, ends_at)
  VALUES (v_b, v_coupon, v_code, 'PROMOTION_CODE', now() + interval '3 months') RETURNING id INTO v_other;

  BEGIN
    INSERT INTO public.tenant_discounts (tenant_id, coupon_id, reason, approved_by, source, ends_at)
    VALUES (v_a, v_coupon, 'Segundo descuento', v_user, 'MANUAL', now() + interval '3 months');
    RAISE EXCEPTION 'A second active discount for the same tenant must be rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  PERFORM set_config('app.tenant_id', v_a::text, true);
  PERFORM set_config('app.user_id', v_user::text, true);
  SET LOCAL ROLE nexodocs_app;

  SELECT count(*) INTO v_seen FROM public.tenant_discounts WHERE id = v_other;
  IF v_seen <> 0 THEN RAISE EXCEPTION 'A tenant read another tenant discount'; END IF;
  SELECT count(*) INTO v_seen FROM public.tenant_discounts WHERE id = v_own;
  IF v_seen <> 1 THEN RAISE EXCEPTION 'A tenant cannot read its own discount'; END IF;

  BEGIN
    UPDATE public.tenant_discounts SET ends_at = now() + interval '10 years' WHERE id = v_own;
    RAISE EXCEPTION 'nexodocs_app must not update tenant_discounts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.tenant_discounts (tenant_id, coupon_id, promotion_code_id, source, ends_at)
    VALUES (v_a, v_coupon, v_code, 'PROMOTION_CODE', now() + interval '1 month');
    RAISE EXCEPTION 'nexodocs_app must not insert tenant_discounts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.coupons LIMIT 1;
    RAISE EXCEPTION 'nexodocs_app must not read coupons';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.promotion_codes LIMIT 1;
    RAISE EXCEPTION 'nexodocs_app must not read promotion_codes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END $$;
ROLLBACK;
\echo 'discounts.sql OK'
