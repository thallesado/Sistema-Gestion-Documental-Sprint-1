\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,100);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='100_physical_archive_recovery') AS applied \gset
\if :applied
 \echo '100_physical_archive_recovery ya aplicada'
\else
-- Schema compatibility must not depend on the caller's column privileges.
-- Otherwise a runtime-created ZIP has a different signature from the SECURITY DEFINER restore.
ALTER FUNCTION app.backup_schema_signature() SECURITY DEFINER;
ALTER FUNCTION app.backup_schema_signature() SET search_path=pg_catalog,public;
REVOKE ALL ON FUNCTION app.backup_schema_signature() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.backup_schema_signature() TO nexodocs_app;
ALTER TABLE physical_movements ADD COLUMN actor_name text;
ALTER TABLE physical_loans ADD COLUMN requester_name text;

-- Active people remain the only choices for new custody. History also resolves inactive identities.
CREATE FUNCTION app.physical_history_people() RETURNS TABLE(id uuid,display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT u.id,concat_ws(' ',u.first_name,u.last_name) FROM users u
 WHERE u.tenant_id=app.current_tenant_id() AND app.context_is_valid() AND app.has_permission('physical:read')
 AND (EXISTS(SELECT 1 FROM physical_movements m WHERE m.tenant_id=u.tenant_id AND m.actor_id=u.id)
   OR EXISTS(SELECT 1 FROM physical_loans l WHERE l.tenant_id=u.tenant_id AND l.requested_by=u.id)
   OR EXISTS(SELECT 1 FROM physical_items i WHERE i.tenant_id=u.tenant_id AND i.custodian_id=u.id))
$$;
ALTER FUNCTION app.physical_history_people() OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_history_people() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.physical_history_people() TO nexodocs_app;

CREATE FUNCTION app.physical_identity_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE person uuid; label text;
BEGIN
 IF TG_TABLE_NAME='physical_loans' THEN person:=NEW.requested_by; ELSE person:=NEW.actor_id; END IF;
 SELECT concat_ws(' ',u.first_name,u.last_name) INTO label FROM users u WHERE u.tenant_id=NEW.tenant_id AND u.id=person;
 IF TG_TABLE_NAME='physical_loans' THEN NEW.requester_name:=coalesce(NEW.requester_name,label,'Usuario historico');
 ELSE NEW.actor_name:=coalesce(NEW.actor_name,label,'Usuario historico'); END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION app.physical_identity_snapshot() OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_identity_snapshot() FROM PUBLIC;
CREATE TRIGGER physical_movement_identity BEFORE INSERT ON physical_movements FOR EACH ROW EXECUTE FUNCTION app.physical_identity_snapshot();
CREATE TRIGGER physical_requester_identity BEFORE INSERT ON physical_loans FOR EACH ROW EXECUTE FUNCTION app.physical_identity_snapshot();

CREATE OR REPLACE FUNCTION app.physical_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF nullif(current_setting('app.physical_import_operation',true),'') IS NOT NULL THEN
 IF app.has_permission('backup:restore') AND EXISTS(
  SELECT 1 FROM tenant_restore_evidence e JOIN tenant_restore_operations r ON r.id=e.operation_id
  WHERE r.id::text=current_setting('app.physical_import_operation',true) AND r.tenant_id=NEW.tenant_id
    AND r.status='COMPLETED' AND e.transaction_id=txid_current()) THEN RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME='physical_items' THEN
  IF NEW.document_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.document_id IS DISTINCT FROM OLD.document_id) AND NOT EXISTS(SELECT 1 FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE='23514'; END IF;
  IF NEW.expedient_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.expedient_id IS DISTINCT FROM OLD.expedient_id) AND NOT EXISTS(SELECT 1 FROM expedients WHERE tenant_id=NEW.tenant_id AND id=NEW.expedient_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Expediente no disponible' USING ERRCODE='23514'; END IF;
  IF (TG_OP='INSERT' OR NEW.custodian_id IS DISTINCT FROM OLD.custodian_id) AND NOT EXISTS(SELECT 1 FROM app.physical_people() WHERE id=NEW.custodian_id) THEN RAISE EXCEPTION 'Custodio no disponible' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- A requester cannot update arbitrary units. This narrow operation only releases their cancelled reservation.
CREATE FUNCTION app.physical_release_reservation(p_loan uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l physical_loans; unit uuid;
BEGIN
 IF NOT app.context_is_valid() OR NOT app.has_permission('physical:read')
 OR NOT app.has_permission('physical:request') THEN RAISE EXCEPTION 'Cancelacion no autorizada' USING ERRCODE='42501'; END IF;
 SELECT item_id INTO unit FROM physical_loans WHERE tenant_id=app.current_tenant_id() AND id=p_loan;
 PERFORM 1 FROM physical_items WHERE tenant_id=app.current_tenant_id() AND id=unit FOR UPDATE;
 SELECT * INTO l FROM physical_loans WHERE tenant_id=app.current_tenant_id() AND id=p_loan FOR UPDATE;
 IF l.id IS NULL OR l.status<>'CANCELLED' OR (l.requested_by<>app.current_user_id() AND NOT app.has_permission('physical:manage')) THEN
  RAISE EXCEPTION 'Cancelacion no autorizada' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM physical_loans WHERE tenant_id=l.tenant_id AND item_id=l.item_id AND status IN('RESERVED','HANDED_OVER')) THEN RETURN false; END IF;
 UPDATE physical_items SET status='AVAILABLE',revision=revision+1,updated_at=now()
 WHERE tenant_id=l.tenant_id AND id=l.item_id AND status='RESERVED';
 RETURN FOUND;
END $$;
ALTER FUNCTION app.physical_release_reservation(uuid) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_release_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.physical_release_reservation(uuid) TO nexodocs_app;

-- SELECT FOR UPDATE otherwise hides the row from a requester without unit-editing privileges.
CREATE FUNCTION app.physical_request_unit(p_id uuid) RETURNS TABLE(id uuid,status text,location_id uuid,custodian_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT app.context_is_valid() OR NOT app.has_permission('physical:read') OR NOT app.has_permission('physical:request') THEN
  RAISE EXCEPTION 'Solicitud no autorizada' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT i.id,i.status::text,i.location_id,i.custodian_id FROM physical_items i
 WHERE i.tenant_id=app.current_tenant_id() AND i.id=p_id FOR UPDATE;
END $$;
ALTER FUNCTION app.physical_request_unit(uuid) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_request_unit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.physical_request_unit(uuid) TO nexodocs_app;

CREATE FUNCTION app.physical_return_location(p_id uuid) RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT app.context_is_valid() OR NOT app.has_permission('physical:read') OR NOT app.has_permission('physical:return') THEN
  RAISE EXCEPTION 'Recepcion no autorizada' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT l.id FROM physical_locations l WHERE l.tenant_id=app.current_tenant_id() AND l.id=p_id AND l.active FOR SHARE;
END $$;
ALTER FUNCTION app.physical_return_location(uuid) OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_return_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.physical_return_location(uuid) TO nexodocs_app;

-- Include physical evidence in new packages without adding it to the tables that are rewound.
ALTER FUNCTION app.capture_tenant_backup(uuid) RENAME TO capture_tenant_backup_before_physical_recovery;
CREATE FUNCTION app.capture_tenant_backup(t uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; evidence jsonb:='{"format_version":1}'; n text; rows jsonb;
BEGIN
 result:=app.capture_tenant_backup_before_physical_recovery(t);
 FOREACH n IN ARRAY ARRAY['physical_locations','physical_items','physical_loans','physical_movements'] LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM public.%I x WHERE tenant_id=$1',n) INTO rows USING t;
  evidence:=evidence||jsonb_build_object(n,rows);
 END LOOP;
 RETURN result||jsonb_build_object('_physical_archive',evidence);
END $$;
REVOKE ALL ON FUNCTION app.capture_tenant_backup_before_physical_recovery(uuid) FROM PUBLIC,nexodocs_app;
REVOKE ALL ON FUNCTION app.capture_tenant_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.capture_tenant_backup(uuid) TO nexodocs_app;

ALTER FUNCTION app.restore_tenant_backup(uuid) RENAME TO restore_tenant_backup_before_physical_recovery;
CREATE FUNCTION app.restore_tenant_backup(op uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation tenant_restore_operations; evidence jsonb; n text; imported uuid[]; unit uuid; foreign_identity boolean;
BEGIN
 IF NOT app.context_is_valid() OR NOT app.has_permission('backup:restore') THEN RAISE EXCEPTION 'Restauracion no autorizada' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT operation FROM tenant_restore_operations WHERE id=op AND tenant_id=app.current_tenant_id() AND status='RUNNING';
 PERFORM pg_advisory_xact_lock(726396,hashtext(operation.tenant_id::text));
 SELECT b.payload->'_physical_archive' INTO evidence FROM tenant_backups b WHERE b.id=operation.backup_id AND b.tenant_id=operation.tenant_id;
 IF evidence IS NOT NULL THEN
  IF jsonb_typeof(evidence)<>'object' OR evidence->>'format_version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Formato de archivo fisico incompatible'; END IF;
  FOREACH n IN ARRAY ARRAY['physical_locations','physical_items','physical_loans','physical_movements'] LOOP
   IF jsonb_typeof(evidence->n) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Respaldo fisico incompleto'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(evidence->n) v WHERE (v->>'tenant_id')::uuid IS DISTINCT FROM operation.tenant_id OR v->>'id' IS NULL) THEN RAISE EXCEPTION 'Evidencia fisica fuera de alcance' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(evidence->n) v GROUP BY v->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Identidad fisica duplicada'; END IF;
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I p JOIN jsonb_array_elements($1) v ON p.id=(v->>''id'')::uuid WHERE p.tenant_id<>$2)',n) INTO foreign_identity USING evidence->n,operation.tenant_id;
   IF foreign_identity THEN RAISE EXCEPTION 'Identidad fisica fuera de alcance' USING ERRCODE='42501'; END IF;
  END LOOP;
 END IF;
 -- Existing rows and every later movement stay authoritative; the normal restore never deletes them.
 PERFORM app.restore_tenant_backup_before_physical_recovery(op);
 IF evidence IS NOT NULL THEN
  PERFORM set_config('app.physical_import_operation',op::text,true);
  INSERT INTO physical_locations SELECT x.* FROM jsonb_populate_recordset(NULL::physical_locations,evidence->'physical_locations') x
   WHERE NOT EXISTS(SELECT 1 FROM physical_locations p WHERE p.id=x.id) ON CONFLICT(id) DO NOTHING;
  SELECT coalesce(array_agg(DISTINCT affected.id),ARRAY[]::uuid[]) INTO imported FROM (
   SELECT x.id FROM jsonb_populate_recordset(NULL::physical_items,evidence->'physical_items') x WHERE NOT EXISTS(SELECT 1 FROM physical_items p WHERE p.id=x.id)
   UNION SELECT x.item_id FROM jsonb_populate_recordset(NULL::physical_loans,evidence->'physical_loans') x WHERE NOT EXISTS(SELECT 1 FROM physical_loans p WHERE p.id=x.id)
   UNION SELECT x.item_id FROM jsonb_populate_recordset(NULL::physical_movements,evidence->'physical_movements') x WHERE NOT EXISTS(SELECT 1 FROM physical_movements p WHERE p.id=x.id)
  ) affected;
  INSERT INTO physical_items SELECT x.* FROM jsonb_populate_recordset(NULL::physical_items,evidence->'physical_items') x
   WHERE NOT EXISTS(SELECT 1 FROM physical_items p WHERE p.id=x.id) ON CONFLICT(id) DO NOTHING;
  INSERT INTO physical_loans SELECT x.* FROM jsonb_populate_recordset(NULL::physical_loans,evidence->'physical_loans') x
   WHERE NOT EXISTS(SELECT 1 FROM physical_loans p WHERE p.id=x.id) ON CONFLICT(id) DO NOTHING;
  INSERT INTO physical_movements SELECT x.* FROM jsonb_populate_recordset(NULL::physical_movements,evidence->'physical_movements') x
   WHERE NOT EXISTS(SELECT 1 FROM physical_movements p WHERE p.id=x.id) ON CONFLICT(id) DO NOTHING;
  -- Recovered evidence cannot assert where the paper is today: a person must reconcile it.
  FOREACH unit IN ARRAY imported LOOP
   UPDATE physical_items SET status='RECONCILIATION_REQUIRED',revision=revision+1,updated_at=now() WHERE tenant_id=operation.tenant_id AND id=unit;
   INSERT INTO physical_movements(tenant_id,item_id,actor_id,action,details) VALUES(operation.tenant_id,unit,app.current_user_id(),'RECOVERED_FOR_RECONCILIATION',jsonb_build_object('operationId',op));
  END LOOP;
  PERFORM set_config('app.physical_import_operation','',true);
 END IF;
END $$;
REVOKE ALL ON FUNCTION app.restore_tenant_backup_before_physical_recovery(uuid) FROM PUBLIC,nexodocs_app;
REVOKE ALL ON FUNCTION app.restore_tenant_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.restore_tenant_backup(uuid) TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES('100_physical_archive_recovery');
\endif
COMMIT;
