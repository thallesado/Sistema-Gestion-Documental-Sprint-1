\set ON_ERROR_STOP on
BEGIN;
-- Regresión de 064_addons: un tenant no ve los complementos de otro, no puede escribirlos, y los
-- paquetes OCR solo se descuentan del tenant del contexto.
DO $$
DECLARE
  v_a uuid; v_b uuid; v_user uuid; v_ocr uuid; v_storage uuid;
  v_own uuid; v_other uuid; v_seen int; v_taken bigint;
BEGIN
  SELECT u.tenant_id, u.id INTO v_a, v_user FROM public.users u
  WHERE u.tenant_id IS NOT NULL AND u.deleted_at IS NULL AND u.status = 'ACTIVE' LIMIT 1;
  SELECT id INTO v_b FROM public.tenants WHERE id <> v_a LIMIT 1;
  IF v_user IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'Need two tenants and an active user; skipping';
    RETURN;
  END IF;
  SELECT id INTO v_ocr FROM public.addons WHERE code = 'OCR_1000';
  SELECT id INTO v_storage FROM public.addons WHERE code = 'STORAGE_10GB';

  INSERT INTO public.tenant_addons (tenant_id, addon_id, units, source, remaining_quantity, expires_at, reason)
  VALUES (v_a, v_ocr, 1, 'COURTESY', 1000, now() + interval '1 month', 'Prueba de regresión') RETURNING id INTO v_own;
  INSERT INTO public.tenant_addons (tenant_id, addon_id, units, source, remaining_quantity, expires_at, reason)
  VALUES (v_b, v_ocr, 1, 'COURTESY', 1000, now() + interval '1 month', 'Prueba de regresión') RETURNING id INTO v_other;

  BEGIN
    INSERT INTO public.tenant_addons (tenant_id, addon_id, units, source) VALUES (v_a, v_storage, 1, 'COURTESY');
    RAISE EXCEPTION 'A courtesy add-on without expiry and reason must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  PERFORM set_config('app.tenant_id', v_a::text, true);
  PERFORM set_config('app.user_id', v_user::text, true);
  SET LOCAL ROLE nexodocs_app;

  SELECT count(*) INTO v_seen FROM public.tenant_addons WHERE id = v_other;
  IF v_seen <> 0 THEN RAISE EXCEPTION 'A tenant read another tenant add-on'; END IF;
  SELECT count(*) INTO v_seen FROM public.tenant_addons WHERE id = v_own;
  IF v_seen <> 1 THEN RAISE EXCEPTION 'A tenant cannot read its own add-on'; END IF;
  PERFORM 1 FROM public.addons LIMIT 1;

  BEGIN
    UPDATE public.tenant_addons SET units = 99 WHERE id = v_own;
    RAISE EXCEPTION 'nexodocs_app must not update tenant_addons';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.tenant_addons (tenant_id, addon_id, units, source) VALUES (v_a, v_storage, 1, 'PURCHASE');
    RAISE EXCEPTION 'nexodocs_app must not insert tenant_addons';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.addon_prices LIMIT 1;
    RAISE EXCEPTION 'nexodocs_app must not read addon_prices';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  v_taken := app.consume_ocr_pack_pages(300);
  IF v_taken < 300 THEN RAISE EXCEPTION 'The own OCR pack was not consumed (%)', v_taken; END IF;
  RESET ROLE;

  IF (SELECT remaining_quantity FROM public.tenant_addons WHERE id = v_other) <> 1000 THEN
    RAISE EXCEPTION 'Consuming OCR pages touched another tenant pack';
  END IF;
END $$;
ROLLBACK;
\echo 'tenant-addons.sql OK'
