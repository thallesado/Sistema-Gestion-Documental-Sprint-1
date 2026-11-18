\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,93);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='093_external_deliveries') AS already_applied \gset
\if :already_applied
 \echo '093_external_deliveries ya aplicada'
\else
INSERT INTO permissions(code,action,module,description) VALUES
 ('document:deliver','deliver','document','Autorizar entrega externa de una versión aprobada'),
 ('delivery:read','read','delivery','Consultar entregas y su trazabilidad'),
 ('delivery:revoke','revoke','delivery','Revocar entregas externas') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
 SELECT DISTINCT r.tenant_id,r.role_id,p.id FROM role_permissions r JOIN permissions a ON a.id=r.permission_id AND a.code='backup:configure'
 CROSS JOIN permissions p WHERE p.code IN('document:deliver','delivery:read','delivery:revoke') ON CONFLICT DO NOTHING;
CREATE TABLE external_deliveries (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id), created_by uuid NOT NULL,
 document_id uuid NOT NULL,version_id uuid NOT NULL,version_number integer NOT NULL,source_checksum varchar(64) NOT NULL,
 recipient_name varchar(150) NOT NULL,recipient_email varchar(254) NOT NULL,
 reason varchar(1000) NOT NULL,allow_download boolean NOT NULL DEFAULT false,
 token_hash varchar(64) NOT NULL UNIQUE, encrypted_token text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 status varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','REVOKED')),
 mail_status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(mail_status IN('PENDING','SMTP_ACCEPTED','FAILED')),
 revoked_at timestamptz,revoked_by uuid,revoke_reason varchar(1000),
 code_hash varchar(64),code_expires_at timestamptz,code_sent_at timestamptz,code_attempts integer NOT NULL DEFAULT 0,code_resends integer NOT NULL DEFAULT 0,
 session_hash varchar(64),session_expires_at timestamptz,last_access_at timestamptz,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '8 days')
);
CREATE INDEX external_delivery_tenant_date ON external_deliveries(tenant_id,created_at DESC);
CREATE TABLE document_mail_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),delivery_id uuid NOT NULL,
 created_by uuid NOT NULL,kind varchar(8) NOT NULL CHECK(kind IN('LINK','CODE')),
 encrypted_body text NOT NULL,status varchar(15) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','SENDING','SENT','FAILED','CANCELLED')),
 attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,
 error_code varchar(100),created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,
 FOREIGN KEY(tenant_id,delivery_id) REFERENCES external_deliveries(tenant_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['external_deliveries','document_mail_outbox'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE TO nexodocs_app USING(tenant_id=app.current_tenant_id() AND app.context_is_valid()) WITH CHECK(tenant_id=app.current_tenant_id() AND app.context_is_valid())',t);
  EXECUTE format('CREATE POLICY delivery_read ON %I FOR SELECT TO nexodocs_app USING(app.has_permission(''delivery:read'') AND app.has_permission(''document:read''))',t);
  EXECUTE format('CREATE POLICY delivery_insert ON %I FOR INSERT TO nexodocs_app WITH CHECK(app.has_permission(''document:deliver'') AND app.has_permission(''document:read''))',t);
  EXECUTE format('CREATE POLICY delivery_update ON %I FOR UPDATE TO nexodocs_app USING(app.has_permission(''document:deliver'') OR app.has_permission(''delivery:revoke''))',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO nexodocs_app',t);
  EXECUTE format('CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes()',t);
 END LOOP;
END $$;
-- Restore cannot resurrect tokens or desend email. Keep the communication ledger, not its secrets in ZIPs.
GRANT SELECT,INSERT,UPDATE ON external_deliveries,document_mail_outbox TO nexodocs_platform_admin;
ALTER FUNCTION app.backup_tables() RENAME TO backup_tables_before_delivery;
CREATE FUNCTION app.backup_tables() RETURNS SETOF text LANGUAGE sql STABLE AS $$
 SELECT x FROM app.backup_tables_before_delivery() x WHERE x NOT IN('external_deliveries','document_mail_outbox')
$$;

CREATE FUNCTION app.delivery_public(p_id uuid,p_token_hash text,p_action text,p_code_hash text,p_session_hash text,p_body text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e external_deliveries; v document_versions; d documents; actor_ok boolean; event_name text;
BEGIN
 SELECT * INTO e FROM external_deliveries WHERE id=p_id AND token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR e.status<>'ACTIVE' OR e.expires_at<=now() THEN RETURN '{"available":false}'::jsonb; END IF;
 PERFORM set_config('app.tenant_id',e.tenant_id::text,true);
 PERFORM set_config('app.user_id',e.created_by::text,true);
 actor_ok:=app.has_permission('document:deliver') AND app.has_permission('document:read') AND app.context_is_valid();
 IF NOT actor_ok OR app.tenant_backup_maintenance(e.tenant_id) THEN RETURN '{"available":false}'::jsonb; END IF;
 SELECT * INTO d FROM documents WHERE id=e.document_id AND tenant_id=e.tenant_id AND deleted_at IS NULL;
 IF NOT FOUND OR d.status IN('VOIDED','TRASHED','ARCHIVED') THEN RETURN '{"available":false}'::jsonb; END IF;
 SELECT * INTO v FROM document_versions WHERE id=e.version_id AND document_id=e.document_id AND tenant_id=e.tenant_id AND checksum_sha256=e.source_checksum;
 IF NOT FOUND THEN RETURN '{"available":false}'::jsonb; END IF;
 IF p_action='code' THEN
  IF e.code_resends>=5 OR (e.code_sent_at IS NOT NULL AND e.code_sent_at>now()-interval '60 seconds') THEN RETURN '{"available":false,"rateLimited":true}'::jsonb; END IF;
  UPDATE external_deliveries SET code_hash=p_code_hash,code_expires_at=now()+interval '10 minutes',code_sent_at=now(),code_attempts=0,code_resends=code_resends+1,session_hash=NULL,session_expires_at=NULL WHERE id=e.id;
  INSERT INTO document_mail_outbox(tenant_id,delivery_id,created_by,kind,encrypted_body) VALUES(e.tenant_id,e.id,e.created_by,'CODE',p_body);
  event_name:='EXTERNAL_CODE_REQUESTED';
 ELSIF p_action='verify' THEN
  IF e.code_hash IS NULL OR e.code_expires_at<=now() OR e.code_attempts>=5 THEN RETURN '{"available":false}'::jsonb; END IF;
  IF e.code_hash<>p_code_hash THEN
   UPDATE external_deliveries SET code_attempts=code_attempts+1 WHERE id=e.id;
   INSERT INTO audit_events(tenant_id,action,entity_type,entity_id,result,details) VALUES(e.tenant_id,'EXTERNAL_CODE_FAILED','DELIVERY',e.id,'FAILURE','{"actorKind":"EXTERNAL"}');
   RETURN '{"available":false}'::jsonb;
  END IF;
  UPDATE external_deliveries SET session_hash=p_session_hash,session_expires_at=least(e.expires_at,now()+interval '20 minutes'),code_hash=NULL,code_expires_at=NULL WHERE id=e.id;
  event_name:='EXTERNAL_VERIFIED';
 ELSIF p_action IN('info','view','download') THEN
  IF e.session_hash IS NULL OR e.session_hash IS DISTINCT FROM p_session_hash OR e.session_expires_at<=now() THEN RETURN '{"available":false}'::jsonb; END IF;
  IF p_action='download' AND NOT e.allow_download THEN RETURN '{"available":false}'::jsonb; END IF;
  IF p_action='view' AND v.mime_type NOT IN('application/pdf','image/png','image/jpeg') THEN RETURN '{"available":false}'::jsonb; END IF;
  IF p_action='info' THEN
   RETURN jsonb_build_object('available',true,'name',d.name,'version',e.version_number,'fileName',v.file_name,'mimeType',v.mime_type,'allowDownload',e.allow_download,'expiresAt',e.expires_at);
  END IF;
  UPDATE external_deliveries SET last_access_at=now() WHERE id=e.id;
  event_name:=CASE WHEN p_action='download' THEN 'EXTERNAL_DOWNLOAD' ELSE 'EXTERNAL_VIEW' END;
 ELSE RETURN '{"available":false}'::jsonb;
 END IF;
 INSERT INTO audit_events(tenant_id,action,entity_type,entity_id,result,details) VALUES(e.tenant_id,event_name,'DELIVERY',e.id,'SUCCESS',jsonb_build_object('actorKind','EXTERNAL','deliveryId',e.id,'versionId',e.version_id));
 IF p_action IN('view','download') THEN RETURN jsonb_build_object('available',true,'path',v.file_path,'checksum',v.checksum_sha256,'mimeType',v.mime_type,'fileName',v.file_name); END IF;
 RETURN '{"available":true}'::jsonb;
END $$;
ALTER FUNCTION app.delivery_public(uuid,text,text,text,text,text) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.delivery_public(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.delivery_public(uuid,text,text,text,text,text) TO nexodocs_app;

CREATE FUNCTION app.revoke_deliveries_after_restore() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE external_deliveries SET status='REVOKED',revoked_at=now(),revoke_reason='Restauración del tenant',session_hash=NULL,session_expires_at=NULL,code_hash=NULL,encrypted_token='' WHERE tenant_id=NEW.tenant_id AND status='ACTIVE';
  UPDATE document_mail_outbox SET status='CANCELLED',encrypted_body='' WHERE tenant_id=NEW.tenant_id AND status<>'SENT';
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION app.revoke_deliveries_after_restore() OWNER TO nexodocs_platform_admin;
CREATE TRIGGER deliveries_restore_guard AFTER UPDATE OF status ON tenant_restore_operations FOR EACH ROW EXECUTE FUNCTION app.revoke_deliveries_after_restore();
INSERT INTO app.schema_migrations(version) VALUES('093_external_deliveries');
\endif
COMMIT;
