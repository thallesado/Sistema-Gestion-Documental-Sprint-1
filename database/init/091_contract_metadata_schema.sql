\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 91);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '091_contract_metadata_schema') AS already_applied \gset
\if :already_applied
  \echo '091_contract_metadata_schema ya aplicada'
\else
-- The demo "Contrato" document type only declared its required keys, so the UI showed the raw
-- property names (supplier, effectiveDate) and the server accepted any text as the effective date.
-- Declare titles and types so the form labels the fields and effectiveDate is validated as a date.
UPDATE document_types
   SET metadata_schema = '{
         "required": ["supplier", "effectiveDate"],
         "properties": {
           "supplier":      {"type": "string", "title": "Proveedor", "minLength": 1, "maxLength": 200},
           "effectiveDate": {"type": "string", "title": "Fecha de vigencia", "format": "date"}
         }
       }'::jsonb
 WHERE code = 'CONTRACT'
   AND metadata_schema = '{"required": ["supplier", "effectiveDate"]}'::jsonb;
INSERT INTO app.schema_migrations(version) VALUES ('091_contract_metadata_schema');
\endif
COMMIT;
