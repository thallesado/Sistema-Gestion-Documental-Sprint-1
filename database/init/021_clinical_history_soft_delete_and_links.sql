\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 21);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '021_clinical_history_soft_delete_and_links'
) AS already_applied \gset

\if :already_applied
  \echo '021_clinical_history_soft_delete_and_links ya aplicada'
\else
  -- 1. Agregar columnas para baja lógica (soft delete) con justificación obligatoria a clinical_histories
  ALTER TABLE clinical_histories
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deletion_reason text,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id);

  -- 2. Índice parcial para consultas de historias clínicas activas por tenant
  CREATE INDEX IF NOT EXISTS idx_clinical_histories_active
    ON clinical_histories (tenant_id, patient_id)
    WHERE deleted_at IS NULL;

  -- 3. Asegurar permisos DML sobre clinical_document_links y clinical_histories para nexodocs_app
  GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_document_links TO nexodocs_app;
  GRANT UPDATE ON clinical_histories TO nexodocs_app;

  -- 4. Registrar permisos granulares en el catálogo de seguridad
  INSERT INTO permissions (code, module, action, description) VALUES
    ('clinical_history:delete', 'clinical', 'delete', 'Dar de baja historia clínica con justificación requerida'),
    ('clinical_document:link', 'clinical', 'link', 'Vincular y desvincular documentos clínicos del expediente')
  ON CONFLICT (code) DO NOTHING;

  -- 5. Asignar los permisos a los roles clínicos y administrativos
  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r CROSS JOIN permissions p
  WHERE r.name IN ('Administrador de tenant', 'Supervisor', 'Usuario operativo')
    AND p.code IN ('clinical_history:delete', 'clinical_document:link')
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('021_clinical_history_soft_delete_and_links');
\endif

COMMIT;
