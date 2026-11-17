\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 59059);

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
  -- Tenant-local billing state is needed by the application. The public
  -- tenant_signups table remains in the shared control plane and is omitted.
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(80);
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(80);
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status varchar(30);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_stripe_customer
    ON public.tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_stripe_subscription
    ON public.tenants(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

  CREATE OR REPLACE FUNCTION app.validate_tenant_user_status()
  RETURNS trigger LANGUAGE plpgsql AS $$
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
  \echo '059_stripe_subscription_billing tenant aplicada exitosamente'
\endif
COMMIT;
