\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 63);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '063_plan_catalog') AS already_applied \gset
\if :already_applied
  \echo '063_plan_catalog ya aplicada'
\else
  -- Catálogo de planes editable por el administrador global (fase 2 del plan de administración).
  -- Tablas globales sin tenant: las escribe el backend con su usuario de conexión, como
  -- platform_audit_events en 062; nexodocs_app no recibe privilegios.

  -- Versiones de precio. Un precio nuevo no reemplaza al anterior: lo archiva para nuevas ventas y
  -- las suscripciones existentes conservan el suyo (grandfathering) salvo migración explícita.
  CREATE TABLE IF NOT EXISTS public.plan_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES plans(id),
    billing_cycle varchar(10) NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL')),
    amount_usd numeric(12,2) NOT NULL CHECK (amount_usd >= 0),
    currency char(3) NOT NULL DEFAULT 'USD',
    -- NULL mientras el precio solo exista en las variables de entorno (app.stripe.prices.*) o sin Stripe.
    stripe_price_id varchar(80) UNIQUE,
    effective_from timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_plan_prices_stripe_id CHECK (stripe_price_id IS NULL OR stripe_price_id LIKE 'price\_%')
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_prices_current ON public.plan_prices (plan_id, billing_cycle)
    WHERE archived_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_plan_prices_plan ON public.plan_prices (plan_id, billing_cycle, effective_from DESC);
  REVOKE ALL ON public.plan_prices FROM PUBLIC;
  REVOKE ALL ON public.plan_prices FROM nexodocs_app;

  -- Versión inicial: los precios actuales del catálogo.
  INSERT INTO public.plan_prices (plan_id, billing_cycle, amount_usd, effective_from)
  SELECT p.id, c.cycle, CASE c.cycle WHEN 'ANNUAL' THEN p.price_yearly ELSE p.price_monthly END, p.created_at
  FROM plans p CROSS JOIN (VALUES ('MONTHLY'), ('ANNUAL')) AS c(cycle)
  WHERE NOT EXISTS (SELECT 1 FROM public.plan_prices pp WHERE pp.plan_id = p.id AND pp.billing_cycle = c.cycle);

  -- Versión de precio que paga cada organización (la fija el webhook de Stripe) y migración programada
  -- a una versión nueva en su próxima renovación.
  ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS plan_price_id uuid REFERENCES public.plan_prices(id),
    ADD COLUMN IF NOT EXISTS price_change_price_id uuid REFERENCES public.plan_prices(id),
    ADD COLUMN IF NOT EXISTS price_change_at timestamptz;
  ALTER TABLE tenants ADD CONSTRAINT ck_tenants_price_change
    CHECK ((price_change_price_id IS NULL) = (price_change_at IS NULL));
  UPDATE tenants t SET plan_price_id = pp.id
  FROM public.plan_prices pp
  WHERE t.plan_price_id IS NULL AND pp.plan_id = t.plan_id AND pp.archived_at IS NULL
    AND pp.billing_cycle = coalesce(t.billing_cycle_v2, 'MONTHLY');

  -- Grupos que se crean en cada organización nueva, además de «Administrador de tenant». Solo
  -- referencian códigos del catálogo de permisos (definido en código y migraciones): al crear el
  -- grupo se descartan los inexistentes y los que el plan no habilita.
  CREATE TABLE IF NOT EXISTS public.default_role_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(80) NOT NULL,
    description varchar(255),
    permission_codes text[] NOT NULL DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_role_templates_name CHECK (char_length(btrim(name)) >= 3),
    CONSTRAINT ck_role_templates_not_admin CHECK (lower(btrim(name)) <> 'administrador de tenant')
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_default_role_templates_name ON public.default_role_templates (lower(btrim(name)));
  REVOKE ALL ON public.default_role_templates FROM PUBLIC;
  REVOKE ALL ON public.default_role_templates FROM nexodocs_app;

  INSERT INTO public.default_role_templates (name, description, permission_codes, sort_order) VALUES
    ('Consulta', 'Lectura de documentos y expedientes',
     ARRAY['document:read', 'document_version:read', 'expedient:read', 'task:read', 'notification:read'], 1),
    ('Gestor documental', 'Alta y edición de documentos y expedientes',
     ARRAY['document:read', 'document:create', 'document:update', 'document:download', 'document_version:read',
           'document_version:create', 'expedient:read', 'expedient:create', 'expedient:update', 'task:read',
           'task:update', 'notification:read', 'workflow:read'], 2)
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('063_plan_catalog');
  \echo '063_plan_catalog aplicada exitosamente'
\endif

COMMIT;
