\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 36);
CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '036_billing_engine') AS already_applied \gset
\if :already_applied
  \echo '036_billing_engine ya aplicada'
\else
  -- Los precios nunca representan un plan gratuito permanente. El precio anual
  -- es el importe total del ciclo anual, no una cuota mensual prorrateada.
  UPDATE plans SET price_monthly = CASE code WHEN 'BASIC' THEN 29 WHEN 'PRO' THEN 79 WHEN 'ENTERPRISE' THEN 249 ELSE price_monthly END,
                   price_yearly = CASE code WHEN 'BASIC' THEN 290 WHEN 'PRO' THEN 790 WHEN 'ENTERPRISE' THEN 2490 ELSE price_yearly END;

  ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'PAST_DUE';
  ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'EXPIRED';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_start_at timestamptz;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS preferred_payment_method varchar(30);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle_v2 varchar(10) NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_cycle_v2 IN ('MONTHLY','ANNUAL'));
  UPDATE tenants SET billing_cycle_v2 = CASE WHEN billing_cycle = 'YEARLY' THEN 'ANNUAL' ELSE 'MONTHLY' END;
  UPDATE tenants SET trial_start_at = coalesce(trial_start_at, created_at),
                     trial_ends_at = coalesce(trial_ends_at, created_at + interval '12 days'),
                     current_period_end = coalesce(current_period_end, now() + interval '30 days')
    WHERE subscription_status = 'TRIAL';

  CREATE TABLE billing_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    amount_usd numeric(12,2) NOT NULL CHECK (amount_usd > 0),
    currency char(3) NOT NULL DEFAULT 'USD',
    payment_method varchar(30) NOT NULL CHECK (payment_method IN ('STRIPE_CARD','BANK_QR','CRYPTO_USDT')),
    status varchar(20) NOT NULL CHECK (status IN ('PENDING','COMPLETED','FAILED')),
    external_reference varchar(160) NOT NULL UNIQUE,
    billing_period varchar(10) NOT NULL CHECK (billing_period IN ('MONTHLY','ANNUAL')),
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
  );
  CREATE INDEX idx_billing_transactions_tenant_created ON billing_transactions(tenant_id, created_at DESC);
  CREATE INDEX idx_billing_transactions_status_created ON billing_transactions(status, created_at DESC);
  ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE billing_transactions FORCE ROW LEVEL SECURITY;
  CREATE POLICY billing_transactions_tenant_context ON billing_transactions AS RESTRICTIVE TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  GRANT SELECT, INSERT, UPDATE ON billing_transactions TO nexodocs_app;
  GRANT UPDATE (plan_id, subscription_status, trial_start_at, trial_ends_at, current_period_end, billing_cycle_v2, preferred_payment_method) ON tenants TO nexodocs_app;

  -- El dashboard global se expone como una proyección de solo lectura con
  -- SECURITY DEFINER, evitando abrir las transacciones de otros tenants.
  CREATE OR REPLACE FUNCTION app.revenue_dashboard()
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
    SELECT jsonb_build_object(
      'totalRevenueUsd', coalesce(sum(amount_usd) FILTER (WHERE status = 'COMPLETED'), 0),
      'mrrUsd', coalesce(sum(amount_usd) FILTER (WHERE status = 'COMPLETED' AND billing_period = 'MONTHLY' AND completed_at >= now() - interval '31 days'), 0),
      'arrUsd', coalesce(sum(amount_usd) FILTER (WHERE status = 'COMPLETED' AND billing_period = 'MONTHLY' AND completed_at >= now() - interval '31 days'), 0) * 12,
      'activeSubscriptions', (SELECT count(*) FROM tenants WHERE subscription_status = 'ACTIVE'),
      'trialSubscriptions', (SELECT count(*) FROM tenants WHERE subscription_status = 'TRIAL'),
      'conversionRate', (SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE subscription_status = 'ACTIVE') / count(*), 2) END FROM tenants WHERE subscription_status IN ('ACTIVE','TRIAL')),
      'revenueByMethod', (SELECT coalesce(jsonb_object_agg(payment_method, total), '{}'::jsonb) FROM (SELECT payment_method, sum(amount_usd) total FROM billing_transactions WHERE status='COMPLETED' GROUP BY payment_method) m),
      'revenueByPlan', (SELECT coalesce(jsonb_object_agg(code, total), '{}'::jsonb) FROM (SELECT p.code, sum(bt.amount_usd) total FROM billing_transactions bt JOIN plans p ON p.id=bt.plan_id WHERE bt.status='COMPLETED' GROUP BY p.code) p),
      'transactions', coalesce(jsonb_agg(jsonb_build_object('id', id, 'tenantName', tenant_name, 'planCode', plan_code, 'amountUsd', amount_usd, 'paymentMethod', payment_method, 'status', status, 'externalReference', external_reference, 'createdAt', created_at) ORDER BY created_at DESC) FILTER (WHERE id IS NOT NULL), '[]'::jsonb)
    )
    FROM (
      SELECT bt.*, t.name AS tenant_name, p.code AS plan_code
      FROM billing_transactions bt JOIN tenants t ON t.id = bt.tenant_id JOIN plans p ON p.id = bt.plan_id
    ) revenue;
  $$;
  ALTER FUNCTION app.revenue_dashboard() OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.revenue_dashboard() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.revenue_dashboard() TO nexodocs_app;

  -- Seeds visibles para el panel desde el primer arranque. Son idempotentes y
  -- representan cobros sandbox ya conciliados.
  INSERT INTO billing_transactions (id, tenant_id, plan_id, amount_usd, payment_method, status, external_reference, billing_period, metadata_json, created_at, completed_at)
  VALUES
    ('b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',79,'STRIPE_CARD','COMPLETED','sandbox_pi_finocode_202610', 'MONTHLY','{"sandbox":true,"brand":"Visa"}', now() - interval '4 days', now() - interval '4 days'),
    ('b0000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003',249,'BANK_QR','COMPLETED','sandbox_qr_clinica_202610', 'MONTHLY','{"sandbox":true,"bank":"NexoBank"}', now() - interval '9 days', now() - interval '9 days'),
    ('b0000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',79,'CRYPTO_USDT','COMPLETED','sandbox_usdt_finocode_202609', 'MONTHLY','{"sandbox":true,"network":"TRC20"}', now() - interval '34 days', now() - interval '34 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('036_billing_engine');
\endif
COMMIT;
