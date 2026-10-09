\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 32);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='032_workflow_template_publication') AS already_applied \gset
\if :already_applied
  \echo '032_workflow_template_publication ya aplicada'
\else
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS publication_status varchar(12) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE workflow_approvals ADD COLUMN IF NOT EXISTS document_version integer;
UPDATE workflow_templates SET publication_status=CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END;
UPDATE workflow_approvals a SET document_version=q.document_version
FROM workflow_tasks q WHERE q.tenant_id=a.tenant_id AND q.id=a.task_id AND a.document_version IS NULL;
ALTER TABLE workflow_templates DROP CONSTRAINT IF EXISTS ck_workflow_template_publication_status;
ALTER TABLE workflow_templates ADD CONSTRAINT ck_workflow_template_publication_status
  CHECK (publication_status IN ('DRAFT','ACTIVE','INACTIVE'));
-- A used template's definition remains immutable, but publication can move to a
-- new version without changing what existing workflows reference.
CREATE OR REPLACE FUNCTION app.protect_used_template() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE template_id uuid; scope_id uuid;
BEGIN
  IF TG_TABLE_NAME='workflow_templates' THEN
    template_id:=OLD.id;scope_id:=OLD.tenant_id;
    IF TG_OP='UPDATE' AND
      (to_jsonb(NEW)-ARRAY['is_active','updated_at','publication_status'])=
      (to_jsonb(OLD)-ARRAY['is_active','updated_at','publication_status']) THEN RETURN NEW; END IF;
  ELSE
    IF TG_OP='INSERT' THEN template_id:=NEW.workflow_template_id;scope_id:=NEW.tenant_id;
    ELSE template_id:=OLD.workflow_template_id;scope_id:=OLD.tenant_id; END IF;
    IF TG_OP='UPDATE' AND NEW.workflow_template_id<>OLD.workflow_template_id THEN
      RAISE EXCEPTION 'No se permite trasladar etapas/transiciones a otra plantilla' USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM public.workflow_templates WHERE tenant_id=scope_id AND id=template_id FOR UPDATE;
  END IF;
  IF EXISTS(SELECT 1 FROM public.workflows WHERE tenant_id=scope_id AND workflow_template_id=template_id) THEN
    RAISE EXCEPTION 'Plantilla utilizada: crear una nueva versión antes de editarla' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;
ALTER FUNCTION app.protect_used_template() SECURITY DEFINER;
ALTER FUNCTION app.protect_used_template() OWNER TO nexodocs_security;
CREATE INDEX IF NOT EXISTS idx_workflow_template_publication
  ON workflow_templates(tenant_id,publication_status,family_id);
INSERT INTO app.schema_migrations(version) VALUES ('032_workflow_template_publication') ON CONFLICT DO NOTHING;
\endif
COMMIT;
