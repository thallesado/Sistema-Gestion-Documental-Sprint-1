\set ON_ERROR_STOP on
BEGIN;
GRANT SELECT ON workflow_documents TO nexodocs_security;
CREATE OR REPLACE FUNCTION app.document_has_active_workflow(scope uuid, document uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.workflow_documents wd JOIN public.workflows w
    ON w.id=wd.workflow_id AND w.tenant_id=wd.tenant_id
    WHERE wd.tenant_id=scope AND scope=nullif(current_setting('app.tenant_id',true),'')::uuid
      AND wd.document_id=document AND w.status IN ('STARTED','IN_PROGRESS','PAUSED') AND w.deleted_at IS NULL)
$$;
ALTER FUNCTION app.document_has_active_workflow(uuid,uuid) OWNER TO nexodocs_security;
REVOKE ALL ON FUNCTION app.document_has_active_workflow(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.document_has_active_workflow(uuid,uuid) TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES ('028_workflow_document_guard') ON CONFLICT DO NOTHING;
COMMIT;
