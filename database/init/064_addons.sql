\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 64);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '064_addons') AS already_applied \gset
\if :already_applied
  \echo '064_addons ya aplicada'
\else
  -- Complementos (add-ons, fase 3 del plan de administración): paquetes que amplían un límite del plan
  -- sin cambiar de plan. Recurrentes (almacenamiento, usuarios, páginas OCR por mes) se cobran como ítem
  -- adicional de la suscripción de Stripe; consumibles (paquetes de páginas OCR) se pagan una vez y
  -- vencen. El límite efectivo es el del plan más los complementos activos.

  -- Catálogo global. nexodocs_app solo lo lee (lo necesita la comprobación de límites en contexto
  -- del tenant, como plan_limits); lo escribe el backend con su usuario de conexión.
  CREATE TABLE IF NOT EXISTS public.addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    description varchar(500),
    resource_key varchar(40) NOT NULL CHECK (resource_key IN ('maxUsers', 'maxStorageMB', 'maxOcrPagesPerMonth')),
    unit_quantity bigint NOT NULL CHECK (unit_quantity > 0),
    kind varchar(12) NOT NULL CHECK (kind IN ('RECURRING', 'CONSUMABLE')),
    validity_months integer,
    plan_codes text[] NOT NULL DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_addons_code CHECK (code ~ '^[A-Z][A-Z0-9_]{2,49}$'),
    -- Solo las páginas OCR se venden como paquete consumible, con vencimiento.
    CONSTRAINT ck_addons_kind CHECK (
      (kind = 'RECURRING' AND validity_months IS NULL)
      OR (kind = 'CONSUMABLE' AND resource_key = 'maxOcrPagesPerMonth' AND validity_months BETWEEN 1 AND 36))
  );
  REVOKE ALL ON public.addons FROM PUBLIC;
  GRANT SELECT ON public.addons TO nexodocs_app;

  -- Versiones de precio, como plan_prices (063): MONTHLY y ANNUAL para recurrentes (Stripe exige el mismo
  -- intervalo que el plan en la suscripción), ONE_TIME para consumibles.
  CREATE TABLE IF NOT EXISTS public.addon_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    addon_id uuid NOT NULL REFERENCES public.addons(id),
    billing_cycle varchar(10) NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL', 'ONE_TIME')),
    amount_usd numeric(12,2) NOT NULL CHECK (amount_usd > 0),
    stripe_price_id varchar(80) UNIQUE CHECK (stripe_price_id IS NULL OR stripe_price_id LIKE 'price\_%'),
    effective_from timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_addon_prices_current ON public.addon_prices (addon_id, billing_cycle)
    WHERE archived_at IS NULL;
  REVOKE ALL ON public.addon_prices FROM PUBLIC;
  REVOKE ALL ON public.addon_prices FROM nexodocs_app;

  -- Complementos de cada organización. units es la cantidad vigente; pending_units la que regirá desde
  -- pending_at (reducir o quitar se aplica al final del período pagado). remaining_quantity es el saldo
  -- de un paquete consumible.
  CREATE TABLE IF NOT EXISTS public.tenant_addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    addon_id uuid NOT NULL REFERENCES public.addons(id),
    units integer NOT NULL CHECK (units >= 1),
    pending_units integer CHECK (pending_units >= 0),
    pending_at timestamptz,
    status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'EXPIRED')),
    source varchar(16) NOT NULL CHECK (source IN ('PURCHASE', 'MANUAL_PAYMENT', 'COURTESY')),
    stripe_subscription_item_id varchar(80) UNIQUE,
    stripe_checkout_id varchar(255) UNIQUE,
    billing_transaction_id uuid UNIQUE REFERENCES billing_transactions(id),
    remaining_quantity bigint CHECK (remaining_quantity >= 0),
    expires_at timestamptz,
    reason varchar(1000),
    granted_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_addons_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ck_tenant_addons_pending CHECK ((pending_units IS NULL) = (pending_at IS NULL)),
    CONSTRAINT ck_tenant_addons_courtesy CHECK (source <> 'COURTESY' OR (expires_at IS NOT NULL AND reason IS NOT NULL))
  );
  CREATE INDEX IF NOT EXISTS idx_tenant_addons_active ON public.tenant_addons (tenant_id, addon_id) WHERE status = 'ACTIVE';
  CREATE INDEX IF NOT EXISTS idx_tenant_addons_due ON public.tenant_addons (pending_at) WHERE pending_at IS NOT NULL;

  -- Lectura para el propio tenant (la comprobación de límites corre con su contexto); sin escritura:
  -- comprar, sincronizar con Stripe y conceder cortesías lo hace el backend con su usuario de conexión.
  ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tenant_addons FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_context ON public.tenant_addons;
  CREATE POLICY tenant_context ON public.tenant_addons AS RESTRICTIVE TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  DROP POLICY IF EXISTS tenant_addons_read ON public.tenant_addons;
  CREATE POLICY tenant_addons_read ON public.tenant_addons FOR SELECT TO nexodocs_app USING (true);
  REVOKE ALL ON public.tenant_addons FROM PUBLIC;
  REVOKE ALL ON public.tenant_addons FROM nexodocs_app;
  GRANT SELECT ON public.tenant_addons TO nexodocs_app;

  -- Descuenta páginas de los paquetes OCR del tenant del contexto, primero los que vencen antes.
  -- Devuelve las páginas descontadas. Única escritura de nexodocs_app sobre tenant_addons.
  CREATE OR REPLACE FUNCTION app.consume_ocr_pack_pages(p_pages bigint) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  DECLARE
    pending bigint := greatest(coalesce(p_pages, 0), 0);
    consumed bigint := 0;
    pack record;
    take bigint;
  BEGIN
    IF pending = 0 THEN RETURN 0; END IF;
    IF NOT app.context_is_valid() THEN RAISE EXCEPTION 'Contexto de tenant no válido' USING ERRCODE = '42501'; END IF;
    FOR pack IN
      SELECT ta.id, ta.remaining_quantity FROM public.tenant_addons ta JOIN public.addons a ON a.id = ta.addon_id
      WHERE ta.tenant_id = app.current_tenant_id() AND ta.status = 'ACTIVE' AND a.kind = 'CONSUMABLE'
        AND ta.remaining_quantity > 0 AND (ta.expires_at IS NULL OR ta.expires_at > now())
      ORDER BY ta.expires_at NULLS LAST, ta.created_at
      FOR UPDATE OF ta
    LOOP
      EXIT WHEN pending = 0;
      take := least(pending, pack.remaining_quantity);
      UPDATE public.tenant_addons SET remaining_quantity = remaining_quantity - take, updated_at = now() WHERE id = pack.id;
      pending := pending - take;
      consumed := consumed + take;
    END LOOP;
    RETURN consumed;
  END $$;
  REVOKE ALL ON FUNCTION app.consume_ocr_pack_pages(bigint) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.consume_ocr_pack_pages(bigint) TO nexodocs_app;

  -- Pago manual (QR/USDT) confirmado de un complemento: crea el complemento del tenant del contexto a
  -- partir de la orden. La orden es la prueba (estado COMPLETED, metadata kind=addon); idempotente.
  CREATE OR REPLACE FUNCTION app.grant_addon_from_payment(p_transaction uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  DECLARE
    tx public.billing_transactions;
    addon public.addons;
    units integer;
    months integer;
  BEGIN
    IF NOT app.context_is_valid() THEN RAISE EXCEPTION 'Contexto de tenant no válido' USING ERRCODE = '42501'; END IF;
    SELECT * INTO tx FROM public.billing_transactions
      WHERE id = p_transaction AND tenant_id = app.current_tenant_id() FOR UPDATE;
    IF NOT FOUND OR tx.status <> 'COMPLETED' OR tx.metadata_json->>'kind' IS DISTINCT FROM 'addon' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM public.tenant_addons WHERE billing_transaction_id = tx.id) THEN RETURN true; END IF;
    SELECT * INTO addon FROM public.addons WHERE id = (tx.metadata_json->>'addonId')::uuid;
    IF NOT FOUND THEN RETURN false; END IF;
    units := (tx.metadata_json->>'units')::integer;
    months := CASE WHEN addon.kind = 'CONSUMABLE' THEN addon.validity_months
                   WHEN tx.billing_period = 'ANNUAL' THEN 12 ELSE 1 END;
    INSERT INTO public.tenant_addons (tenant_id, addon_id, units, source, billing_transaction_id, remaining_quantity, expires_at)
    VALUES (tx.tenant_id, addon.id, units, 'MANUAL_PAYMENT', tx.id,
            CASE WHEN addon.kind = 'CONSUMABLE' THEN units::bigint * addon.unit_quantity END,
            coalesce(tx.completed_at, now()) + make_interval(months => months));
    RETURN true;
  END $$;
  REVOKE ALL ON FUNCTION app.grant_addon_from_payment(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.grant_addon_from_payment(uuid) TO nexodocs_app;

  -- Catálogo inicial (los precios se crean en Stripe desde /platform/addons).
  INSERT INTO public.addons (code, name, description, resource_key, unit_quantity, kind, validity_months, plan_codes, sort_order) VALUES
    ('STORAGE_10GB', 'Almacenamiento adicional', '+10 GB de almacenamiento', 'maxStorageMB', 10240, 'RECURRING', NULL, ARRAY['BASIC', 'PRO'], 1),
    ('USERS_5', 'Usuarios adicionales', '+5 usuarios activos', 'maxUsers', 5, 'RECURRING', NULL, ARRAY['BASIC', 'PRO'], 2),
    ('OCR_1000', 'Paquete de páginas OCR', '1.000 páginas OCR válidas 12 meses', 'maxOcrPagesPerMonth', 1000, 'CONSUMABLE', 12, ARRAY['PRO'], 3)
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.addon_prices (addon_id, billing_cycle, amount_usd)
  SELECT a.id, p.cycle, p.amount FROM public.addons a
  JOIN (VALUES ('STORAGE_10GB', 'MONTHLY', 9.00), ('STORAGE_10GB', 'ANNUAL', 90.00),
               ('USERS_5', 'MONTHLY', 15.00), ('USERS_5', 'ANNUAL', 150.00),
               ('OCR_1000', 'ONE_TIME', 20.00)) AS p(code, cycle, amount) ON p.code = a.code
  WHERE NOT EXISTS (SELECT 1 FROM public.addon_prices x WHERE x.addon_id = a.id AND x.billing_cycle = p.cycle);

  INSERT INTO app.schema_migrations(version) VALUES ('064_addons');
  \echo '064_addons aplicada exitosamente'
\endif

COMMIT;
