\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 4);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
-- Alcance funcional: administración de usuarios, roles y auditoría de tenant
-- (HU-02). Si existe el identificador anterior, se conserva como alias histórico
-- y se registra también el nombre técnico actual sin volver a ejecutar cambios.
SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version IN ('007_tenant_user_management', '007_hu02_tenant_user_management')
) AS already_applied \gset
\if :already_applied
  INSERT INTO app.schema_migrations(version)
  VALUES ('007_tenant_user_management')
  ON CONFLICT DO NOTHING;
  \echo '007_tenant_user_management ya aplicada'
\else
-- 004 conserva los valores históricos PAST_DUE/INVITED/SUSPENDED. HU-02
-- restringe las altas nuevas a los estados públicos del contrato sin romper datos
-- históricos ya existentes.
-- No se añade CHECK aquí: los enums históricos también contienen PAST_DUE,
-- INVITED y SUSPENDED. La migración 008 aplica una validación de nuevas
-- escrituras que conserva filas legadas sin permitir nuevos valores legados.

INSERT INTO permissions (code, module, action, description) VALUES
 ('tenant:manage','tenant','manage','Gestionar tenants globalmente'),
 ('user:manage','user','manage','Gestionar usuarios del tenant'),
 ('role:assign','role','assign','Asignar roles operativos y administrador de tenant'),
 ('audit:read_global','audit','read_global','Consultar auditoría global'),
 ('audit:read_tenant','audit','read_tenant','Consultar auditoría del tenant')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('user:manage','role:assign','audit:read_tenant')
WHERE r.name = 'Administrador de tenant'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION app.enforce_tenant_admin_presence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE admin_count integer;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r
       ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id
       WHERE ur.tenant_id=OLD.tenant_id AND ur.user_id=OLD.id
         AND r.name='Administrador de tenant' AND r.is_active)
     AND (TG_OP='DELETE' OR NEW.status <> 'ACTIVE') THEN
    SELECT count(*) INTO admin_count FROM public.user_roles ur JOIN public.roles r
      ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id
      JOIN public.users u ON u.id=ur.user_id AND u.tenant_id=ur.tenant_id
      WHERE ur.tenant_id=OLD.tenant_id AND r.name='Administrador de tenant'
        AND r.is_active AND u.status='ACTIVE' AND u.deleted_at IS NULL
        AND u.id <> OLD.id;
    IF admin_count = 0 THEN
      RAISE EXCEPTION 'El tenant debe conservar al menos un administrador activo' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_enforce_tenant_admin_presence ON users;
CREATE TRIGGER trg_enforce_tenant_admin_presence BEFORE UPDATE OF status OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION app.enforce_tenant_admin_presence();

INSERT INTO app.schema_migrations(version) VALUES ('007_tenant_user_management');
\endif
COMMIT;
