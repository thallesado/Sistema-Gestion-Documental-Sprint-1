\set ON_ERROR_STOP on
-- Enum additions must commit before application writes use the new labels.
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'EXPIRED';
BEGIN;
ALTER TABLE workflow_tasks DROP CONSTRAINT IF EXISTS ck_task_completion;
ALTER TABLE workflow_tasks ADD CONSTRAINT ck_task_completion CHECK (
  (status IN ('COMPLETED','REJECTED','RETURNED') AND completed_at IS NOT NULL AND completed_by IS NOT NULL)
  OR (status NOT IN ('COMPLETED','REJECTED','RETURNED') AND completed_at IS NULL AND completed_by IS NULL AND outcome IS NULL)
);
DROP TRIGGER IF EXISTS trg_workflow_comments_no_update ON workflow_comments;
DROP TRIGGER IF EXISTS trg_workflow_comments_no_delete ON workflow_comments;
CREATE TRIGGER trg_workflow_comments_no_update BEFORE UPDATE ON workflow_comments FOR EACH ROW EXECUTE FUNCTION app.block_mutation();
CREATE TRIGGER trg_workflow_comments_no_delete BEFORE DELETE ON workflow_comments FOR EACH ROW EXECUTE FUNCTION app.block_mutation();
REVOKE UPDATE,DELETE ON workflow_comments FROM nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES ('027_workflow_task_decisions') ON CONFLICT DO NOTHING;
COMMIT;
