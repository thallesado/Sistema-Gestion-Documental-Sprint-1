\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('065_tenant_payment_routes'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '065_tenant_payment_routes', applied_at FROM app.schema_migrations WHERE version = '060_tenant_payment_routes' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '065_tenant_payment_routes') AS already_applied \gset
\if :already_applied
  \echo '065_tenant_payment_routes ya aplicada'
\else
  -- Global callback index: Stripe webhooks have no tenant JWT and must resolve
  -- the target database without trusting a tenant identifier from the payload.
  CREATE TABLE app.tenant_payment_routes (
    payment_transaction_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    consumed_at timestamptz
  );
  CREATE INDEX tenant_payment_routes_tenant_idx
    ON app.tenant_payment_routes (tenant_id, created_at DESC);
  REVOKE ALL ON app.tenant_payment_routes FROM PUBLIC;
  GRANT SELECT, INSERT, UPDATE ON app.tenant_payment_routes TO nexodocs_app;
  INSERT INTO app.schema_migrations(version) VALUES ('065_tenant_payment_routes');
\endif
COMMIT;
