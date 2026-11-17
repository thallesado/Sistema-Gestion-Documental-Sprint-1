\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 65);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '065_discounts') AS already_applied \gset
\if :already_applied
  \echo '065_discounts ya aplicada'
\else
  -- Descuentos y promociones (fase 4 del plan de administración). Stripe es la fuente de verdad del
  -- cobro: cupones y códigos se crean primero en Stripe y estas tablas son su espejo, con las reglas
  -- de negocio de NexoDocs (planes aplicables, tope y fecha de fin obligatoria).

  -- Cupón: porcentaje o monto fijo durante un pago (ONCE) o N meses (REPEATING). No hay duración
  -- indefinida: todo descuento termina. redeem_by es la fecha límite para canjearlo.
  CREATE TABLE IF NOT EXISTS public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(40) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    percent_off numeric(5,2) CHECK (percent_off > 0 AND percent_off <= 100),
    amount_off_usd numeric(12,2) CHECK (amount_off_usd > 0),
    duration varchar(10) NOT NULL CHECK (duration IN ('ONCE', 'REPEATING')),
    duration_in_months integer,
    plan_codes text[] NOT NULL,
    redeem_by timestamptz NOT NULL,
    stripe_coupon_id varchar(80) UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    deactivated_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_coupons_code CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
    CONSTRAINT ck_coupons_value CHECK ((percent_off IS NULL) <> (amount_off_usd IS NULL)),
    CONSTRAINT ck_coupons_duration CHECK (
      (duration = 'ONCE' AND duration_in_months IS NULL)
      OR (duration = 'REPEATING' AND duration_in_months BETWEEN 1 AND 36)),
    CONSTRAINT ck_coupons_plans CHECK (cardinality(plan_codes) >= 1),
    CONSTRAINT ck_coupons_redeem_by CHECK (redeem_by > created_at)
  );
  REVOKE ALL ON public.coupons FROM PUBLIC;
  REVOKE ALL ON public.coupons FROM nexodocs_app;

  -- Código promocional que el cliente escribe en el checkout; siempre con vencimiento.
  CREATE TABLE IF NOT EXISTS public.promotion_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id),
    code varchar(40) NOT NULL UNIQUE,
    stripe_promotion_code_id varchar(80) UNIQUE,
    max_redemptions integer CHECK (max_redemptions > 0),
    expires_at timestamptz NOT NULL,
    first_time_only boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    deactivated_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_promotion_codes_code CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{2,39}$')
  );
  CREATE INDEX IF NOT EXISTS idx_promotion_codes_coupon ON public.promotion_codes (coupon_id);
  REVOKE ALL ON public.promotion_codes FROM PUBLIC;
  REVOKE ALL ON public.promotion_codes FROM nexodocs_app;

  -- Descuento de una organización: canje de un código en el checkout o descuento aprobado por la
  -- plataforma (cliente frecuente o caso puntual), que exige motivo y aprobador. Una sola vigente.
  CREATE TABLE IF NOT EXISTS public.tenant_discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id),
    promotion_code_id uuid REFERENCES public.promotion_codes(id),
    source varchar(16) NOT NULL CHECK (source IN ('PROMOTION_CODE', 'LOYALTY', 'MANUAL')),
    status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'REMOVED')),
    reason varchar(1000),
    approved_by uuid REFERENCES users(id),
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz NOT NULL,
    stripe_subscription_id varchar(80),
    stripe_checkout_id varchar(255) UNIQUE,
    removed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_discounts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ck_tenant_discounts_period CHECK (ends_at > starts_at),
    CONSTRAINT ck_tenant_discounts_code CHECK ((source = 'PROMOTION_CODE') = (promotion_code_id IS NOT NULL)),
    CONSTRAINT ck_tenant_discounts_approval CHECK (source = 'PROMOTION_CODE' OR (reason IS NOT NULL AND approved_by IS NOT NULL))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_discounts_active ON public.tenant_discounts (tenant_id) WHERE status = 'ACTIVE';
  CREATE INDEX IF NOT EXISTS idx_tenant_discounts_coupon ON public.tenant_discounts (coupon_id);

  -- Lectura para el propio tenant; sin escritura: el backend la escribe con su usuario de conexión.
  ALTER TABLE public.tenant_discounts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tenant_discounts FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_context ON public.tenant_discounts;
  CREATE POLICY tenant_context ON public.tenant_discounts AS RESTRICTIVE TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  DROP POLICY IF EXISTS tenant_discounts_read ON public.tenant_discounts;
  CREATE POLICY tenant_discounts_read ON public.tenant_discounts FOR SELECT TO nexodocs_app USING (true);
  REVOKE ALL ON public.tenant_discounts FROM PUBLIC;
  REVOKE ALL ON public.tenant_discounts FROM nexodocs_app;
  GRANT SELECT ON public.tenant_discounts TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('065_discounts');
  \echo '065_discounts aplicada exitosamente'
\endif

COMMIT;
