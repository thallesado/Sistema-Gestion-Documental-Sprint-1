\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 24);

-- Repair existing installations as well as fresh databases. PostgreSQL 17
-- clears only the optional patient reference, preserving tenant ownership.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS fk_documents_patient;
ALTER TABLE public.documents ADD CONSTRAINT fk_documents_patient
  FOREIGN KEY (tenant_id, patient_id)
  REFERENCES public.patients(tenant_id, id)
  ON DELETE SET NULL (patient_id);

INSERT INTO app.schema_migrations(version)
VALUES ('024_document_patient_relation') ON CONFLICT DO NOTHING;
COMMIT;
