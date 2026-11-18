\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,94);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='094_document_mail_intake') AS already_applied \gset
\if :already_applied
 \echo '094_document_mail_intake ya aplicada'
\else
INSERT INTO permissions(code,action,module,description) VALUES
 ('mailbox:manage','manage','mailbox','Configurar buzones y reglas de recepción'),
 ('mail-intake:read','read','mail-intake','Revisar recepción documental'),
 ('mail-intake:accept','accept','mail-intake','Incorporar adjuntos al archivo'),
 ('mail-intake:reject','reject','mail-intake','Rechazar adjuntos recibidos') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
 SELECT DISTINCT r.tenant_id,r.role_id,p.id FROM role_permissions r JOIN permissions a ON a.id=r.permission_id AND a.code='backup:configure'
 CROSS JOIN permissions p WHERE p.module IN('mailbox','mail-intake') ON CONFLICT DO NOTHING;
CREATE TABLE mailbox_connections (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name varchar(150) NOT NULL,
 profile_key varchar(80) NOT NULL,folder varchar(150) NOT NULL DEFAULT 'INBOX',
 subject_filter varchar(150) NOT NULL DEFAULT '',sender_filter varchar(254) NOT NULL DEFAULT '',
 enabled boolean NOT NULL DEFAULT false,state varchar(20) NOT NULL DEFAULT 'DISCONNECTED',
 since_at timestamptz NOT NULL DEFAULT now(),uid_validity bigint,last_uid bigint NOT NULL DEFAULT 0,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),last_sync_at timestamptz,error_code varchar(100),
 UNIQUE(tenant_id,id),UNIQUE(profile_key,folder),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE mail_intake_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),connection_id uuid NOT NULL,
 uid_validity bigint NOT NULL,message_uid bigint NOT NULL,part_number integer NOT NULL,
 sender varchar(254) NOT NULL,subject varchar(255) NOT NULL,received_at timestamptz,
 file_name varchar(255) NOT NULL,mime_type varchar(150) NOT NULL,file_size_bytes bigint NOT NULL,
 checksum varchar(64),file_path text,
 status varchar(30) NOT NULL CHECK(status IN('SCAN_PENDING','QUARANTINED','REVIEW_PENDING','IMPORTED','REJECTED','FAILED','RECONCILIATION_REQUIRED')),
 scan_result varchar(100),error_code varchar(100),document_id uuid,version_id uuid,
 imported_by uuid,imported_at timestamptz,reject_reason varchar(1000),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,connection_id,uid_validity,message_uid,part_number),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES mailbox_connections(tenant_id,id)
);
CREATE TABLE document_operation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),connection_id uuid NOT NULL,created_by uuid NOT NULL,
 status varchar(15) NOT NULL DEFAULT 'QUEUED' CHECK(status IN('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,completed_at timestamptz,lease_until timestamptz,
 received_count integer NOT NULL DEFAULT 0,error_code varchar(100),
 FOREIGN KEY(tenant_id,connection_id) REFERENCES mailbox_connections(tenant_id,id)
);
CREATE UNIQUE INDEX mailbox_one_job ON document_operation_jobs(tenant_id,connection_id) WHERE status IN('QUEUED','RUNNING');
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['mailbox_connections','mail_intake_items','document_operation_jobs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE TO nexodocs_app USING(tenant_id=app.current_tenant_id() AND app.context_is_valid()) WITH CHECK(tenant_id=app.current_tenant_id() AND app.context_is_valid())',t);
  EXECUTE format('CREATE POLICY mail_read ON %I FOR SELECT TO nexodocs_app USING(app.has_permission(''mail-intake:read'') OR app.has_permission(''mailbox:manage''))',t);
  EXECUTE format('CREATE POLICY mail_write ON %I FOR ALL TO nexodocs_app USING(app.has_permission(''mailbox:manage'') OR app.has_permission(''mail-intake:accept'') OR app.has_permission(''mail-intake:reject'')) WITH CHECK(app.has_permission(''mailbox:manage'') OR app.has_permission(''mail-intake:accept'') OR app.has_permission(''mail-intake:reject''))',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO nexodocs_app',t);
  EXECUTE format('CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes()',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON mailbox_connections,mail_intake_items,document_operation_jobs TO nexodocs_platform_admin;
ALTER FUNCTION app.backup_tables() RENAME TO backup_tables_before_mail;
CREATE FUNCTION app.backup_tables() RETURNS SETOF text LANGUAGE sql STABLE AS $$
 SELECT x FROM app.backup_tables_before_mail() x WHERE x NOT IN('mailbox_connections','mail_intake_items','document_operation_jobs')
$$;
-- Reconcile external effects after a logical restore, instead of replaying mail as new documents.
CREATE FUNCTION app.reconcile_mail_after_restore() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE mail_intake_items i SET status='RECONCILIATION_REQUIRED',error_code='DOCUMENT_NOT_IN_RESTORED_STATE'
   WHERE i.tenant_id=NEW.tenant_id AND i.status='IMPORTED' AND NOT EXISTS(SELECT 1 FROM document_versions v WHERE v.tenant_id=i.tenant_id AND v.id=i.version_id);
  UPDATE document_operation_jobs SET status='CANCELLED',error_code='TENANT_RESTORED' WHERE tenant_id=NEW.tenant_id AND status IN('QUEUED','RUNNING');
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION app.reconcile_mail_after_restore() OWNER TO nexodocs_platform_admin;
CREATE TRIGGER mail_restore_guard AFTER UPDATE OF status ON tenant_restore_operations FOR EACH ROW EXECUTE FUNCTION app.reconcile_mail_after_restore();
INSERT INTO app.schema_migrations(version) VALUES('094_document_mail_intake');
\endif
COMMIT;
