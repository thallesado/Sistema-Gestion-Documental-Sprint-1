\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 20);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '020_medical_note_status'
) AS already_applied \gset

\if :already_applied
  \echo '020_medical_note_status ya aplicada'
\else
  -- 1. Agregar columna status con default DRAFT y tipo enum document_status existente
  ALTER TABLE medical_notes
    ADD COLUMN IF NOT EXISTS status document_status NOT NULL DEFAULT 'DRAFT';

  -- 2. Backfill defensivo por si existiera algún registro previo
  UPDATE medical_notes SET status = 'DRAFT' WHERE status IS NULL;

  -- 3. CHECK de dominio clínico: las notas médicas solo admiten el subconjunto DRAFT, APPROVED, VOIDED
  ALTER TABLE medical_notes DROP CONSTRAINT IF EXISTS chk_medical_notes_status;
  ALTER TABLE medical_notes ADD CONSTRAINT chk_medical_notes_status
    CHECK (status IN ('DRAFT', 'APPROVED', 'VOIDED'));

  -- 4. Índice para optimizar consultas de listado filtradas por estado
  CREATE INDEX IF NOT EXISTS idx_medical_notes_tenant_status
    ON medical_notes (tenant_id, status);

  -- 5. Privilegios DML: nexodocs_app requiere UPDATE para transiciones de estado
  GRANT UPDATE ON medical_notes TO nexodocs_app;

  -- 6. Permisos del sistema para actualización de notas médicas
  INSERT INTO permissions (code, module, action, description) VALUES
    ('medical_note:update', 'medical_note', 'update', 'Actualizar y cambiar estado de notas médicas')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r CROSS JOIN permissions p
  WHERE r.name IN ('Administrador de tenant', 'Supervisor', 'Usuario operativo')
    AND p.code IN ('medical_note:update')
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('020_medical_note_status');
\endif

COMMIT;
