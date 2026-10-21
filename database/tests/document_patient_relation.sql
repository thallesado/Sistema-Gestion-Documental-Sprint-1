\set ON_ERROR_STOP on
BEGIN;
-- All fixture changes, including audit records, are rolled back.
DO $$
DECLARE
  doc_id uuid;
  owner_tenant uuid;
  other_tenant uuid;
  fixture_patient uuid := gen_random_uuid();
  foreign_patient uuid := gen_random_uuid();
BEGIN
  SELECT id, tenant_id INTO doc_id, owner_tenant FROM documents LIMIT 1;
  SELECT id INTO other_tenant FROM tenants WHERE id <> owner_tenant LIMIT 1;
  IF doc_id IS NULL OR other_tenant IS NULL THEN
    RAISE EXCEPTION 'Test requires a document and two tenants';
  END IF;
  INSERT INTO patients(id, tenant_id, first_name, last_name)
  VALUES (fixture_patient, owner_tenant, 'Relation', 'Fixture'),
         (foreign_patient, other_tenant, 'Foreign', 'Fixture');
  UPDATE documents SET patient_id = fixture_patient WHERE id = doc_id;
  DELETE FROM patients WHERE id = fixture_patient;
  IF NOT EXISTS (SELECT 1 FROM documents WHERE id = doc_id
      AND tenant_id = owner_tenant AND patient_id IS NULL) THEN
    RAISE EXCEPTION 'Patient deletion changed tenant or removed document';
  END IF;
  BEGIN
    UPDATE documents SET patient_id = foreign_patient WHERE id = doc_id;
    RAISE EXCEPTION 'Cross-tenant patient relation was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  RAISE NOTICE 'PASS: tenant preserved, document retained, cross-tenant link rejected';
END $$;
ROLLBACK;
