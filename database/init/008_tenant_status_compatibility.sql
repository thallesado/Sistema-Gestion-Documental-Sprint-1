\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 4);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
-- Alcance funcional: compatibilidad de estados de tenant y usuario
-- (HU-02). Si existe el identificador anterior, se conserva como alias histórico
-- y se registra también el nombre técnico actual sin volver a ejecutar cambios.
SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version IN ('008_tenant_status_compatibility', '008_hu02_status_compatibility')
) AS already_applied \gset
\if :already_applied
  INSERT INTO app.schema_migrations(version)
  VALUES ('008_tenant_status_compatibility')
  ON CONFLICT DO NOTHING;
  \echo '008_tenant_status_compatibility ya aplicada'
\else
-- Corrección para instalaciones que llegaron a ejecutar una versión previa de
-- 007 con CHECK incompatibles. Los CHECK se eliminan de forma idempotente.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS ck_hu02_tenant_status;
ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_hu02_user_status;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('user:manage','role:assign','audit:read_tenant')
WHERE r.name = 'Administrador de tenant'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION app.validate_tenant_user_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'tenants'
     AND NEW.subscription_status NOT IN ('TRIAL','ACTIVE','SUSPENDED','CANCELED') THEN
    RAISE EXCEPTION 'Estado de tenant no permitido: %', NEW.subscription_status
      USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'users'
     AND NEW.status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN
    RAISE EXCEPTION 'Estado de usuario no permitido: %', NEW.status
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_tenant_status ON tenants;
CREATE TRIGGER trg_validate_tenant_status
BEFORE INSERT OR UPDATE OF subscription_status ON tenants
FOR EACH ROW EXECUTE FUNCTION app.validate_tenant_user_status();
DROP TRIGGER IF EXISTS trg_validate_user_status ON users;
CREATE TRIGGER trg_validate_user_status
BEFORE INSERT OR UPDATE OF status ON users
FOR EACH ROW EXECUTE FUNCTION app.validate_tenant_user_status();

INSERT INTO app.schema_migrations(version) VALUES ('008_tenant_status_compatibility');
\endif
COMMIT;
