\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,90);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='090_document_retention_transfers') AS already_applied \gset
\if :already_applied
  \echo '090_document_retention_transfers ya aplicada'
\else
ALTER TABLE retention_policies DROP CONSTRAINT retention_policies_disposition_action_check;
ALTER TABLE retention_policies ADD CONSTRAINT retention_policies_disposition_action_check
 CHECK(disposition_action IN ('REVIEW','ARCHIVE','ANONYMIZE','DELETE','KEEP','TRANSFER'));
ALTER TABLE documents ADD COLUMN archive_level varchar(20) NOT NULL DEFAULT 'MANAGEMENT'
 CHECK(archive_level IN ('MANAGEMENT','CENTRAL','HISTORICAL'));
ALTER TABLE documents ADD COLUMN archive_level_since date;
GRANT SELECT(archive_level,archive_level_since),UPDATE(archive_level,archive_level_since) ON documents TO nexodocs_app;
CREATE POLICY documents_transfer_update ON documents FOR UPDATE TO nexodocs_app
 USING((SELECT app.has_permission('document:archive'))) WITH CHECK((SELECT app.has_permission('document:archive')));
CREATE TABLE document_transfers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) DEFERRABLE INITIALLY IMMEDIATE,
 document_id uuid NOT NULL, policy_id uuid NOT NULL,
 retention_months integer NOT NULL CHECK(retention_months>=0), eligible_on date NOT NULL,
 from_level varchar(20) NOT NULL, to_level varchar(20) NOT NULL,
 reason varchar(1000) NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 1000),
 status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','APPROVED','EXECUTED')),
 requested_by uuid NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(),
 approved_by uuid, approved_at timestamptz, executed_by uuid, executed_at timestamptz,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(tenant_id,policy_id) REFERENCES retention_policies(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(tenant_id,requested_by) REFERENCES users(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(tenant_id,approved_by) REFERENCES users(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(tenant_id,executed_by) REFERENCES users(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE,
 CHECK((from_level='MANAGEMENT' AND to_level='CENTRAL') OR (from_level='CENTRAL' AND to_level='HISTORICAL')),
 CHECK((status='REQUESTED' AND approved_by IS NULL AND approved_at IS NULL AND executed_by IS NULL AND executed_at IS NULL)
 OR (status='APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND executed_by IS NULL AND executed_at IS NULL)
 OR (status='EXECUTED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND executed_by IS NOT NULL AND executed_at IS NOT NULL))
);
CREATE UNIQUE INDEX document_transfers_pending ON document_transfers(tenant_id,document_id) WHERE status IN ('REQUESTED','APPROVED');
ALTER TABLE document_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON document_transfers AS RESTRICTIVE TO nexodocs_app
 USING(tenant_id=(SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
 WITH CHECK(tenant_id=(SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
CREATE POLICY transfers_read ON document_transfers FOR SELECT TO nexodocs_app USING((SELECT app.has_permission('document:read')));
CREATE POLICY transfers_create ON document_transfers FOR INSERT TO nexodocs_app
 WITH CHECK((SELECT app.has_permission('document:archive')) AND requested_by=(SELECT app.current_user_id()));
CREATE POLICY transfers_update ON document_transfers FOR UPDATE TO nexodocs_app USING((SELECT app.has_permission('document:archive')));
GRANT SELECT ON document_transfers TO nexodocs_app;
GRANT INSERT(id,tenant_id,document_id,policy_id,retention_months,eligible_on,from_level,to_level,reason,requested_by) ON document_transfers TO nexodocs_app;
GRANT UPDATE(status,approved_by,approved_at,executed_by,executed_at) ON document_transfers TO nexodocs_app;
CREATE FUNCTION app.guard_document_transfer() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app AS $$
BEGIN
 IF OLD.status='EXECUTED' OR NOT ((OLD.status='REQUESTED' AND NEW.status='APPROVED') OR (OLD.status='APPROVED' AND NEW.status='EXECUTED')) THEN
   RAISE EXCEPTION 'Transicion de transferencia no permitida' USING ERRCODE='23514';
 END IF;
 IF NEW.status='APPROVED' AND (NEW.approved_by IS DISTINCT FROM app.current_user_id() OR NEW.approved_at IS NULL) THEN
   RAISE EXCEPTION 'Aprobador invalido' USING ERRCODE='23514';
 END IF;
 IF NEW.status='EXECUTED' AND (NEW.executed_by IS DISTINCT FROM app.current_user_id() OR NEW.executed_at IS NULL) THEN
   RAISE EXCEPTION 'Ejecutor invalido' USING ERRCODE='23514';
 END IF;
 IF NEW.status='EXECUTED' AND NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.document_id AND d.archive_level=NEW.to_level AND d.archive_level_since=current_date) THEN
   RAISE EXCEPTION 'La transferencia debe actualizar el nivel del documento en la misma transaccion' USING ERRCODE='23514';
 END IF;
 IF OLD.status='APPROVED' AND (NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
   RAISE EXCEPTION 'La evidencia de aprobacion no puede alterarse' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_document_transfer BEFORE UPDATE ON document_transfers FOR EACH ROW EXECUTE FUNCTION app.guard_document_transfer();
INSERT INTO app.schema_migrations(version) VALUES('090_document_retention_transfers');
\endif
COMMIT;
