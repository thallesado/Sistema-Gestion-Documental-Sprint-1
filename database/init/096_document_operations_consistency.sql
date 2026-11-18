\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,96);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='096_document_operations_consistency') AS already_applied \gset
\if :already_applied
 \echo '096_document_operations_consistency ya aplicada'
\else
-- The old SECURITY DEFINER owner could not write through FORCE RLS, aborting document creation.
-- Keep the operation narrow: current active tenant, existing write permission, nonnegative deltas.
CREATE OR REPLACE FUNCTION app.record_tenant_monthly_usage(p_tenant_id uuid,p_documents int DEFAULT 0,p_storage_bytes bigint DEFAULT 0,p_ocr_pages int DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_tenant_id IS DISTINCT FROM app.current_tenant_id() OR NOT app.context_is_valid()
 OR NOT (app.has_permission('document:create') OR app.has_permission('document:update') OR app.has_permission('ocr:create'))
 OR p_documents<0 OR p_storage_bytes<0 OR p_ocr_pages<0 THEN RAISE EXCEPTION 'Consumo no autorizado' USING ERRCODE='42501'; END IF;
 INSERT INTO tenant_usage_monthly(tenant_id,year_month,api_calls,ocr_pages,documents_created,storage_bytes,updated_at)
 VALUES(p_tenant_id,date_trunc('month',now())::date,0,p_ocr_pages,p_documents,p_storage_bytes,now())
 ON CONFLICT(tenant_id,year_month) DO UPDATE SET
 ocr_pages=tenant_usage_monthly.ocr_pages+excluded.ocr_pages,
 documents_created=tenant_usage_monthly.documents_created+excluded.documents_created,
 storage_bytes=tenant_usage_monthly.storage_bytes+excluded.storage_bytes,updated_at=now();
END $$;
ALTER FUNCTION app.record_tenant_monthly_usage(uuid,int,bigint,int) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.record_tenant_monthly_usage(uuid,int,bigint,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_tenant_monthly_usage(uuid,int,bigint,int) TO nexodocs_app;
ALTER TABLE mailbox_connections ADD COLUMN retention_days int NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 365);
ALTER TABLE mail_intake_items ADD COLUMN purged_at timestamptz;
ALTER TABLE mail_intake_items ADD COLUMN ocr_result jsonb;
ALTER TABLE mail_intake_items ADD COLUMN ocr_status varchar(30);
ALTER TABLE mail_intake_items ADD COLUMN message_identity varchar(64);
CREATE INDEX mail_origin_identity ON mail_intake_items(tenant_id,connection_id,message_identity,part_number);
CREATE FUNCTION app.reconcile_physical_after_restore() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE physical_items i SET status='RECONCILIATION_REQUIRED',revision=revision+1,updated_at=now()
  WHERE i.tenant_id=NEW.tenant_id AND i.status='AVAILABLE' AND
  ((i.document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=i.tenant_id AND d.id=i.document_id AND d.deleted_at IS NULL))
   OR (i.expedient_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM expedients e WHERE e.tenant_id=i.tenant_id AND e.id=i.expedient_id AND e.deleted_at IS NULL)));
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION app.reconcile_physical_after_restore() OWNER TO nexodocs_platform_admin;
CREATE TRIGGER physical_restore_guard AFTER UPDATE OF status ON tenant_restore_operations FOR EACH ROW EXECUTE FUNCTION app.reconcile_physical_after_restore();
INSERT INTO app.schema_migrations(version) VALUES('096_document_operations_consistency');
\endif
COMMIT;
