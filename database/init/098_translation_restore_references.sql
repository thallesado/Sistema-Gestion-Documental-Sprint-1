\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,98);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='098_translation_restore_references') AS applied \gset
\if :applied
 \echo '098_translation_restore_references ya aplicada'
\else
-- The persistent translation ledger must survive removal of a digital source by logical restore.
-- Identity/tenant references remain enforced; source availability is checked by application operations.
DO $$ DECLARE constraint_name text; BEGIN
 FOR constraint_name IN
  SELECT conname FROM pg_constraint WHERE conrelid='public.translation_requests'::regclass
   AND contype='f' AND confrelid IN('public.documents'::regclass,'public.document_versions'::regclass)
 LOOP EXECUTE format('ALTER TABLE public.translation_requests DROP CONSTRAINT %I',constraint_name); END LOOP;
END $$;
INSERT INTO app.schema_migrations(version) VALUES('098_translation_restore_references');
\endif
COMMIT;
