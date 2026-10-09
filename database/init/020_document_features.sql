-- Migración 020: Extensiones de Clasificación Documental, Metadatos y Estados Documentales
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 20);
DO $$
BEGIN
  ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'CORRECTED' AFTER 'REJECTED';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS patient_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS specialty varchar(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS institutional_process varchar(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_patient') THEN
    ALTER TABLE documents ADD CONSTRAINT fk_documents_patient
      FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id) ON DELETE SET NULL (patient_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(tenant_id, patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_specialty ON documents(tenant_id, specialty) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_process ON documents(tenant_id, institutional_process) WHERE deleted_at IS NULL;
INSERT INTO app.schema_migrations(version) VALUES ('020_document_features') ON CONFLICT DO NOTHING;
COMMIT;
