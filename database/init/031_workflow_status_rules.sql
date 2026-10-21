\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394,31);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='031_workflow_status_rules') AS already_applied \gset
\if :already_applied
  \echo '031_workflow_status_rules ya aplicada'
\else
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS document_status_rules jsonb NOT NULL DEFAULT
  '{"ON_START":"UNCHANGED","ON_REVIEW":"IN_REVIEW","ON_APPROVE":"APPROVED","ON_REJECT":"REJECTED","ON_RETURN":"DRAFT","ON_ARCHIVE":"ARCHIVED"}'::jsonb;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS document_status_rules jsonb NOT NULL DEFAULT
  '{"ON_START":"UNCHANGED","ON_REVIEW":"IN_REVIEW","ON_APPROVE":"APPROVED","ON_REJECT":"REJECTED","ON_RETURN":"DRAFT","ON_ARCHIVE":"ARCHIVED"}'::jsonb;
INSERT INTO app.schema_migrations(version) VALUES ('031_workflow_status_rules') ON CONFLICT DO NOTHING;
\endif
COMMIT;
