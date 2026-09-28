\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 4);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
-- Alcance funcional: identificadores de paciente, antecedentes y cronología
-- del expediente (HU-03, HU-04 y HU-07). Si existe el identificador anterior,
-- se conserva como alias histórico y se registra también el nombre técnico
-- actual sin volver a ejecutar cambios.
SELECT EXISTS (SELECT 1 FROM app.schema_migrations
  WHERE version IN ('009_clinical_domain_extensions', '009_hu03_hu04_hu07_clinical')
) AS already_applied \gset
\if :already_applied
  INSERT INTO app.schema_migrations(version)
  VALUES ('009_clinical_domain_extensions')
  ON CONFLICT DO NOTHING;
  \echo '009_clinical_domain_extensions ya aplicada'
\else
-- El identificador es único dentro del tenant, incluso si cambia su formato
-- (espacios/mayúsculas). No se modifica la restricción histórica de 001.
CREATE UNIQUE INDEX uq_patients_tenant_identifier_normalized
  ON patients (tenant_id, upper(btrim(document_type)), upper(btrim(document_number)))
  WHERE document_type IS NOT NULL AND document_number IS NOT NULL
    AND deleted_at IS NULL;

ALTER TABLE clinical_histories
  ADD COLUMN base_diagnoses jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE clinical_histories
  ADD CONSTRAINT ck_clinical_histories_base_diagnoses
  CHECK (jsonb_typeof(base_diagnoses) = 'array');

INSERT INTO permissions (code, module, action, description) VALUES
 ('patient:create','patient','create','Crear paciente y abrir expediente'),
 ('patient:read','patient','read','Consultar expedientes clínicos'),
 ('patient:update','patient','update','Actualizar datos clínicos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app.schema_migrations(version)
  VALUES ('009_clinical_domain_extensions');
\endif
COMMIT;
