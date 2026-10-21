\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 47);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '047_subscription_payments'
) AS already_applied \gset

\if :already_applied
  \echo '047_subscription_payments ya aplicada'
\else
  -- A3: Tabla para registrar intentos de suscripción y pagos simulados
  CREATE TABLE IF NOT EXISTS subscription_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES plans(id) ON DELETE RESTRICT,
    company_name varchar(150) NOT NULL,
    admin_email varchar(150) NOT NULL,
    amount_usd numeric(12,2) NOT NULL DEFAULT 0.00,
    currency varchar(3) NOT NULL DEFAULT 'USD',
    payment_method varchar(30) NOT NULL DEFAULT 'SIMULATED_CARD',
    billing_period varchar(10) NOT NULL DEFAULT 'MONTHLY' CHECK (billing_period IN ('MONTHLY', 'ANNUAL')),
    status varchar(20) NOT NULL DEFAULT 'COMPLETED',
    simulated boolean NOT NULL DEFAULT true,
    transaction_reference varchar(100) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant ON subscription_payments(tenant_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status, created_at DESC);

  ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS subscription_payments_tenant_policy ON subscription_payments;
  CREATE POLICY subscription_payments_tenant_policy ON subscription_payments
    FOR ALL TO nexodocs_app
    USING (tenant_id IS NULL OR tenant_id = (SELECT app.current_tenant_id()))
    WITH CHECK (tenant_id IS NULL OR tenant_id = (SELECT app.current_tenant_id()));

  GRANT SELECT, INSERT, UPDATE ON subscription_payments TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('047_subscription_payments');
  \echo '047_subscription_payments aplicada exitosamente'
\endif

COMMIT;
