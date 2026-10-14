\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 35);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '035_ocr_job_persistence'
) AS already_applied \gset

\if :already_applied
  \echo '035_ocr_job_persistence ya aplicada'
\else
  -- El revisor puede rechazar una extraccion: no es un fallo tecnico (FAILED) ni
  -- una validacion, y las metricas de aceptacion necesitan distinguirlo.
  -- El valor no se usa dentro de esta transaccion (PostgreSQL lo exige asi).
  ALTER TYPE ocr_status ADD VALUE IF NOT EXISTS 'REJECTED';

  ALTER TABLE ocr_jobs
    ADD COLUMN IF NOT EXISTS original_filename varchar(255),
    ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
    ADD COLUMN IF NOT EXISTS model_used varchar(100),
    ADD COLUMN IF NOT EXISTS processing_ms integer,
    ADD COLUMN IF NOT EXISTS final_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

  ALTER TABLE ocr_jobs
    ADD CONSTRAINT ck_ocr_file_size CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    ADD CONSTRAINT ck_ocr_processing_ms CHECK (processing_ms IS NULL OR processing_ms >= 0),
    ADD CONSTRAINT ck_ocr_final_metadata_object CHECK (jsonb_typeof(final_metadata) = 'object'),
    ADD CONSTRAINT ck_ocr_indexed_has_document CHECK (status <> 'INDEXED' OR document_id IS NOT NULL),
    ADD CONSTRAINT ck_ocr_failed_has_reason CHECK (status <> 'FAILED' OR error_message IS NOT NULL);

  CREATE INDEX IF NOT EXISTS idx_ocr_jobs_tenant_created ON ocr_jobs (tenant_id, created_at DESC);

  INSERT INTO app.schema_migrations(version) VALUES ('035_ocr_job_persistence');
  \echo '035_ocr_job_persistence aplicada exitosamente'
\endif

COMMIT;
