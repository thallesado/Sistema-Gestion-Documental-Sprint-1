\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 25);
-- Preserve legacy text values and array order; leave structured entries intact.
DO $$
DECLARE
  field_name text;
  value_key text;
BEGIN
  FOR field_name, value_key IN
    SELECT * FROM (VALUES ('allergies', 'allergen'),
      ('current_medications', 'name'), ('base_diagnoses', 'description')) AS fields(col, key)
  LOOP
    EXECUTE format(
      'UPDATE public.clinical_histories h SET %1$I =
        (SELECT jsonb_agg(CASE WHEN jsonb_typeof(entry) = ''string''
          THEN jsonb_build_object(%2$L, entry #>> ''{}'') ELSE entry END ORDER BY position)
         FROM jsonb_array_elements(h.%1$I) WITH ORDINALITY AS items(entry, position))
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(h.%1$I) AS entry
         WHERE jsonb_typeof(entry) = ''string'')', field_name, value_key);
  END LOOP;
END $$;
INSERT INTO app.schema_migrations(version)
VALUES ('025_clinical_legacy_json_entries') ON CONFLICT DO NOTHING;
COMMIT;
