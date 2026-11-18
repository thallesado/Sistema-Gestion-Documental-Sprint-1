\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,101);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='101_mail_intake_receive_only') AS applied \gset
\if :applied
 \echo '101_mail_intake_receive_only ya aplicada'
\else
ALTER TABLE public.mail_intake_items DROP CONSTRAINT mail_intake_items_status_check;
ALTER TABLE public.mail_intake_items ADD CONSTRAINT mail_intake_items_status_check
 CHECK(status IN('RECEIVED','SCAN_PENDING','QUARANTINED','REVIEW_PENDING','IMPORTED','REJECTED','FAILED','RECONCILIATION_REQUIRED'));
-- Preserve historical scan results; received never means antivirus-clean.
INSERT INTO app.schema_migrations(version) VALUES('101_mail_intake_receive_only');
\endif
COMMIT;
