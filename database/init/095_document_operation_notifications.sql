\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,95);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='095_document_operation_notifications') AS already_applied \gset
\if :already_applied
 \echo '095_document_operation_notifications ya aplicada'
\else
CREATE FUNCTION app.physical_loan_notice(p_loan uuid,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l physical_loans; i physical_items; recipient uuid;
BEGIN
 IF NOT app.has_permission('physical:read') OR p_kind NOT IN('REQUESTED','RESERVED','OVERDUE') THEN RAISE EXCEPTION 'Notificación no autorizada' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT l FROM physical_loans WHERE tenant_id=app.current_tenant_id() AND id=p_loan;
 SELECT * INTO STRICT i FROM physical_items WHERE tenant_id=l.tenant_id AND id=l.item_id;
 IF p_kind='REQUESTED' AND (l.requested_by<>app.current_user_id() OR NOT app.has_permission('physical:request')) THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF p_kind IN('RESERVED','OVERDUE') AND NOT app.has_permission('physical:approve') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 FOR recipient IN SELECT DISTINCT x FROM unnest(CASE WHEN p_kind='REQUESTED' THEN ARRAY[i.custodian_id] ELSE ARRAY[l.requested_by,i.custodian_id] END) x LOOP
  INSERT INTO notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id)
   VALUES(l.tenant_id,recipient,'PHYSICAL_'||p_kind,CASE p_kind WHEN 'OVERDUE' THEN 'Devolución pendiente' WHEN 'RESERVED' THEN 'Original reservado' ELSE 'Solicitud de préstamo' END,
   'Consulta el estado y los movimientos del original en Archivo físico.','physical_item',i.id);
 END LOOP;
END $$;
ALTER FUNCTION app.physical_loan_notice(uuid,text) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_loan_notice(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.physical_loan_notice(uuid,text) TO nexodocs_app;
CREATE FUNCTION app.intake_import_notice(p_item uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i mail_intake_items; recipient uuid;
BEGIN
 IF NOT app.has_permission('mail-intake:accept') THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT i FROM mail_intake_items WHERE tenant_id=app.current_tenant_id() AND id=p_item AND status='IMPORTED' AND imported_by=app.current_user_id();
 SELECT coalesce(responsible_id,author_id) INTO recipient FROM documents WHERE tenant_id=i.tenant_id AND id=i.document_id;
 IF recipient IS NOT NULL THEN INSERT INTO notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id) VALUES(i.tenant_id,recipient,'MAIL_IMPORTED','Documento recibido por correo','Hay un documento incorporado desde el buzón documental.','document',i.document_id); END IF;
END $$;
ALTER FUNCTION app.intake_import_notice(uuid) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.intake_import_notice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.intake_import_notice(uuid) TO nexodocs_app;
-- Separate worker identity lookup; the backup scheduler remains restricted to backup permissions.
CREATE FUNCTION app.document_operations_actor(p_tenant uuid,p_permission text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT u.id FROM users u JOIN user_roles ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id
 JOIN role_permissions rp ON rp.tenant_id=ur.tenant_id AND rp.role_id=ur.role_id
 JOIN permissions p ON p.id=rp.permission_id AND p.is_active
 WHERE u.tenant_id=p_tenant AND p_tenant=app.current_tenant_id()
 AND p.code=p_permission AND p_permission IN('document:deliver','physical:approve','mailbox:manage')
 AND u.status='ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_platform_admin
 ORDER BY u.created_at,u.id LIMIT 1
$$;
ALTER FUNCTION app.document_operations_actor(uuid,text) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.document_operations_actor(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.document_operations_actor(uuid,text) TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES('095_document_operation_notifications');
\endif
COMMIT;
