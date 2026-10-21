\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 18);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '018_clinical_roles_and_permission_criticality'
) AS already_applied \gset

\if :already_applied
  \echo '018_clinical_roles_and_permission_criticality ya aplicada'
\else
  ALTER TABLE permissions ADD COLUMN IF NOT EXISTS criticality varchar(10) NOT NULL DEFAULT 'MEDIUM';
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_permissions_criticality') THEN
      ALTER TABLE permissions ADD CONSTRAINT ck_permissions_criticality
        CHECK (criticality IN ('LOW','MEDIUM','HIGH'));
    END IF;
  END $$;

  UPDATE permissions SET criticality = 'HIGH'
    WHERE action IN ('delete','approve','reject','archive');
  UPDATE permissions SET criticality = 'LOW'
    WHERE action IN ('read','download');

  -- Roles clínicos base para cada tenant existente. Los permisos se otorgan
  -- por módulo/acción reutilizando el catálogo ya sembrado (003_seed.sql).
  DO $$
  DECLARE tenant_row RECORD;
  BEGIN
    FOR tenant_row IN SELECT id FROM tenants LOOP
      INSERT INTO roles (tenant_id, name, description, is_system)
      VALUES
        (tenant_row.id, 'Médico Especialista', 'Gestión clínica de pacientes, expedientes y documentos médicos.', true),
        (tenant_row.id, 'Enfermero/a Jefe', 'Seguimiento clínico y actualización de expedientes de pacientes.', true),
        (tenant_row.id, 'Administrador de Clínica', 'Administración completa de la organización clínica.', true),
        (tenant_row.id, 'Auditor Médico', 'Revisión y auditoría de historiales clínicos y documentos.', true),
        (tenant_row.id, 'Recepción', 'Registro de pacientes y apertura de expedientes.', true)
      ON CONFLICT (tenant_id, name) DO NOTHING;
    END LOOP;
  END;
  $$;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id FROM roles r CROSS JOIN permissions p
  WHERE r.name = 'Administrador de Clínica'
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p ON
    p.action IN ('read','create','update','approve','download')
    AND p.module IN ('expedient','document','document_version','patient')
  WHERE r.name = 'Médico Especialista'
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p ON
    p.action IN ('read','update','download')
    AND p.module IN ('expedient','document','patient')
  WHERE r.name = 'Enfermero/a Jefe'
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p ON
    p.action = 'read'
    AND p.module IN ('expedient','document','document_version','patient','audit','report')
  WHERE r.name = 'Auditor Médico'
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p ON
    p.action IN ('read','create')
    AND p.module IN ('expedient','document','patient')
  WHERE r.name = 'Recepción'
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version)
  VALUES ('018_clinical_roles_and_permission_criticality');
\endif
COMMIT;
