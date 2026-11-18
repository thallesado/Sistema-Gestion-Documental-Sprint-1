\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,99);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='099_translation_review_concurrency') AS applied \gset
\if :applied
 \echo '099_translation_review_concurrency ya aplicada'
\else
ALTER TABLE translation_segments ADD COLUMN review_revision integer NOT NULL DEFAULT 0 CHECK(review_revision>=0);
INSERT INTO app.schema_migrations(version) VALUES('099_translation_review_concurrency');
\endif
COMMIT;
