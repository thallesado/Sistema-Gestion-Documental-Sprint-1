\set ON_ERROR_STOP on

-- Dataset reproducible y no destructivo. Este archivo NO está en database/init:
-- debe invocarse explícitamente con psql como propietario/migrador.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 300);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenants
    WHERE id = '20000000-0000-0000-0000-000000000001'
      AND name = 'FinoCode'
  ) THEN
    RAISE EXCEPTION 'No existe el tenant FinoCode esperado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = '40000000-0000-0000-0000-000000000001'
      AND tenant_id = '20000000-0000-0000-0000-000000000001'
      AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'No existe el usuario sintético activo de carga';
  END IF;
END $$;

-- Los rangos de UUID están reservados para esta carga. Abortamos si alguien
-- reutilizó uno fuera de Acme, en vez de ocultar una colisión con DO NOTHING.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM patients
  WHERE id BETWEEN '60000000-0000-0000-0000-000000000001'::uuid
                AND '60000000-0000-0000-0000-000000000300'::uuid
    AND tenant_id <> '20000000-0000-0000-0000-000000000001';
  IF n > 0 THEN RAISE EXCEPTION 'Colisión de IDs de pacientes fuera del tenant (% filas)', n; END IF;
  SELECT count(*) INTO n
  FROM documents
  WHERE id BETWEEN '62000000-0000-0000-0000-000000000001'::uuid
                AND '62000000-0000-0000-0000-000000000300'::uuid
    AND tenant_id <> '20000000-0000-0000-0000-000000000001';
  IF n > 0 THEN RAISE EXCEPTION 'Colisión de IDs de documentos fuera del tenant (% filas)', n; END IF;
END $$;

WITH rows AS (
  SELECT n,
    ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS patient_id
  FROM generate_series(1, 300) AS g(n)
)
INSERT INTO patients
  (id, tenant_id, document_type, document_number, first_name, last_name,
   birth_date, gender, phone, email, address, status)
SELECT patient_id, '20000000-0000-0000-0000-000000000001',
       CASE WHEN n % 3 = 0 THEN 'SYNTHETIC-ID' ELSE 'SYNTHETIC-CODE' END,
       'ACME-SYN-' || lpad(n::text, 4, '0'),
       (ARRAY['Alex','Jordan','Taylor','Morgan','Casey','Riley'])[1 + n % 6],
       (ARRAY['Sample','Demo','Test','Fictitious','Example','Synthetic'])[1 + n % 6]
         || ' ' || lpad(n::text, 3, '0'),
       DATE '1970-01-01' + (n * 37 % 16000),
       (ARRAY['UNSPECIFIED','NON_BINARY','FEMALE','MALE'])[1 + n % 4],
       '+000-555-' || lpad(n::text, 4, '0'),
       'synthetic.patient.' || lpad(n::text, 4, '0') || '@example.invalid',
       'Synthetic address block ' || (1 + n % 20),
       'ACTIVE'
FROM rows
ON CONFLICT DO NOTHING;

WITH rows AS (
  SELECT n,
    ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS patient_id,
    ('61000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS history_id
  FROM generate_series(1, 300) AS g(n)
)
INSERT INTO clinical_histories
  (id, tenant_id, patient_id, code, blood_type, pathological_antecedents,
   non_pathological_antecedents, family_antecedents, allergies,
   chronic_conditions, current_medications, observations)
SELECT history_id, '20000000-0000-0000-0000-000000000001', patient_id,
       'ACME-HC-SYN-' || lpad(n::text, 4, '0'),
       (ARRAY['O+','A+','B+','AB+'])[1 + n % 4],
       'Synthetic antecedent set ' || n,
       'Synthetic non-pathological profile ' || n,
       'Synthetic family profile ' || n,
       CASE WHEN n % 5 = 0 THEN ('["synthetic-allergen-' || n || '"]')::jsonb ELSE '[]'::jsonb END,
       CASE WHEN n % 7 = 0 THEN 'Synthetic condition ' || n ELSE NULL END,
       CASE WHEN n % 6 = 0 THEN ('["synthetic-medication-' || n || '"]')::jsonb ELSE '[]'::jsonb END,
       'Dataset sintético reproducible; no corresponde a una persona real.'
FROM rows
ON CONFLICT DO NOTHING;

WITH rows AS (
  SELECT n,
    ('62000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS document_id,
    ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS patient_id
  FROM generate_series(1, 300) AS g(n)
)
INSERT INTO documents
  (id, tenant_id, expedient_id, document_type_id, author_id, responsible_id,
   department_id, code, name, description, status, current_version,
   source, issue_date)
SELECT document_id, '20000000-0000-0000-0000-000000000001',
       '54000000-0000-0000-0000-000000000001',
       '52000000-0000-0000-0000-000000000001',
       '40000000-0000-0000-0000-000000000001',
       '40000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000003',
       'ACME-SYN-DOC-' || lpad(n::text, 4, '0'),
       'Synthetic clinical document ' || lpad(n::text, 4, '0'),
       'Documento de prueba sintético asociado al paciente ' || lpad(n::text, 4, '0'),
       'DRAFT', 1, 'SYNTHETIC_SEED', DATE '2026-01-01' + n
FROM rows
ON CONFLICT DO NOTHING;

WITH rows AS (
  SELECT n,
    ('62000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS document_id,
    ('63000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS version_id
  FROM generate_series(1, 300) AS g(n)
)
INSERT INTO document_versions
  (id, tenant_id, document_id, version_number, author_id, change_reason,
   file_path, file_name, mime_type, file_size_bytes, checksum_sha256, content)
SELECT version_id, '20000000-0000-0000-0000-000000000001', document_id, 1,
       '40000000-0000-0000-0000-000000000001', 'Initial synthetic dataset',
       'synthetic/acme-patients/patient-' || lpad(n::text, 4, '0') || '.txt',
       'patient-' || lpad(n::text, 4, '0') || '.txt', 'text/plain',
       0, NULL,
       jsonb_build_object('synthetic', true, 'sequence', n,
                          'notice', 'No real personal data')
FROM rows
WHERE NOT EXISTS (
  SELECT 1 FROM document_versions v
  WHERE v.tenant_id = '20000000-0000-0000-0000-000000000001'
    AND v.document_id = rows.document_id AND v.version_number = 1
)
ON CONFLICT DO NOTHING;

WITH rows AS (
  SELECT n,
    ('62000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS document_id,
    ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS patient_id,
    ('61000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS history_id
  FROM generate_series(1, 300) AS g(n)
)
INSERT INTO clinical_document_links
  (tenant_id, document_id, patient_id, clinical_history_id)
SELECT '20000000-0000-0000-0000-000000000001', document_id, patient_id, history_id
FROM rows
ON CONFLICT DO NOTHING;

-- Garantiza que una ejecución parcial no se considere exitosa.
DO $$
BEGIN
  IF (SELECT count(*) FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
      AND id BETWEEN '60000000-0000-0000-0000-000000000001'::uuid AND '60000000-0000-0000-0000-000000000300'::uuid) <> 300
  OR (SELECT count(*) FROM clinical_histories WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
      AND id BETWEEN '61000000-0000-0000-0000-000000000001'::uuid AND '61000000-0000-0000-0000-000000000300'::uuid) <> 300
  OR (SELECT count(*) FROM documents WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
      AND id BETWEEN '62000000-0000-0000-0000-000000000001'::uuid AND '62000000-0000-0000-0000-000000000300'::uuid) <> 300
  OR (SELECT count(*) FROM document_versions WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
      AND id BETWEEN '63000000-0000-0000-0000-000000000001'::uuid AND '63000000-0000-0000-0000-000000000300'::uuid) <> 300
  OR (SELECT count(*) FROM clinical_document_links WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
      AND document_id BETWEEN '62000000-0000-0000-0000-000000000001'::uuid AND '62000000-0000-0000-0000-000000000300'::uuid) <> 300
  THEN RAISE EXCEPTION 'La carga sintética quedó incompleta'; END IF;
END $$;

COMMIT;
