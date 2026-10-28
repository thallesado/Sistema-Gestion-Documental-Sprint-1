\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 59);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '059_stripe_subscription_billing'
) AS already_applied \gset

\if :already_applied
  \echo '059_stripe_subscription_billing ya aplicada'
\else
  -- Stripe Billing cobra y renueva; la aplicación solo refleja su estado. Se guarda
  -- el estado Stripe tal cual (stripe_subscription_status) aparte del estado de
  -- acceso (subscription_status) para no deshacer suspensiones manuales.
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(80);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(80);
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status varchar(30);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_stripe_customer
    ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_stripe_subscription
    ON tenants(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

  -- Alta pública pendiente de pago. La contraseña elegida se guarda solo como hash
  -- BCrypt aquí (nunca en el metadata de Stripe) y se vacía al completar o expirar.
  CREATE TABLE IF NOT EXISTS tenant_signups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    billing_period varchar(10) NOT NULL CHECK (billing_period IN ('MONTHLY','ANNUAL')),
    tenant_name varchar(160) NOT NULL,
    company_email varchar(150) NOT NULL,
    administrator_name varchar(160) NOT NULL,
    admin_email varchar(150) NOT NULL,
    password_hash text NOT NULL DEFAULT '',
    status varchar(20) NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING','PROVISIONING','COMPLETED','FAILED','EXPIRED')),
    tenant_id uuid UNIQUE REFERENCES tenants(id) ON DELETE SET NULL,
    stripe_checkout_id varchar(120) UNIQUE,
    stripe_customer_id varchar(80),
    stripe_subscription_id varchar(80),
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_tenant_signups_status_updated ON tenant_signups(status, updated_at);

  -- Tabla de plataforma sin tenant: solo la usa el backend fuera del contexto de
  -- organización (alta pública y webhook firmado). El rol de aplicación no la ve.
  ALTER TABLE tenant_signups ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON tenant_signups FROM PUBLIC;
  REVOKE ALL ON tenant_signups FROM nexodocs_app;

  -- 036 agregó EXPIRED al tipo, pero la validación de 010 seguía rechazándolo.
  CREATE OR REPLACE FUNCTION app.validate_tenant_user_status()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF TG_TABLE_NAME = 'users' THEN
      IF NEW.status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN
        RAISE EXCEPTION 'Estado de usuario inválido';
      END IF;
    ELSIF TG_TABLE_NAME = 'tenants' THEN
      IF NEW.subscription_status NOT IN ('TRIAL','ACTIVE','PAST_DUE','EXPIRED','SUSPENDED','CANCELED') THEN
        RAISE EXCEPTION 'Estado de suscripción inválido';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

  INSERT INTO app.schema_migrations(version) VALUES ('059_stripe_subscription_billing');
  \echo '059_stripe_subscription_billing aplicada exitosamente'
\endif

COMMIT;
