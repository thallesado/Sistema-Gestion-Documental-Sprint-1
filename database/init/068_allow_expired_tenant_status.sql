\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, hashtext('068_allow_expired_tenant_status'));

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version, applied_at) SELECT '068_allow_expired_tenant_status', applied_at FROM app.schema_migrations WHERE version = '063_allow_expired_tenant_status' ON CONFLICT (version) DO NOTHING;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '068_allow_expired_tenant_status') AS already_applied \gset
\if :already_applied
  \echo '068_allow_expired_tenant_status ya aplicada'
\else
  CREATE OR REPLACE FUNCTION app.validate_tenant_user_status()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp AS $$
  BEGIN
    IF TG_TABLE_NAME = 'tenants' THEN
      IF NEW.subscription_status NOT IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELED','EXPIRED') THEN
        RAISE EXCEPTION 'Estado de tenant no permitido: %', NEW.subscription_status
          USING ERRCODE = '23514';
      END IF;
    ELSIF TG_TABLE_NAME = 'users' THEN
      IF NEW.status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN
        RAISE EXCEPTION 'Estado de usuario no permitido: %', NEW.status
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END
  $$;
  INSERT INTO app.schema_migrations(version) VALUES ('068_allow_expired_tenant_status');
\endif
COMMIT;
