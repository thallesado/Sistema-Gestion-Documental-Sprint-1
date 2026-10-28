\set ON_ERROR_STOP on
-- Execute only against an isolated migrated copy, never the working database.
BEGIN;
DO $$
DECLARE actor record; other uuid; target uuid:=gen_random_uuid(); safety uuid:=gen_random_uuid(); op uuid:=gen_random_uuid();
 original jsonb; displaced jsonb; recovered jsonb; before_b jsonb; after_b jsonb; n text; left_rows jsonb; right_rows jsonb; event_id bigint; original_hash text;
BEGIN
 SELECT id,tenant_id INTO STRICT actor FROM users WHERE email='laura@acme.com' AND deleted_at IS NULL LIMIT 1;
 SELECT id INTO STRICT other FROM tenants WHERE id<>actor.tenant_id LIMIT 1;
 PERFORM set_config('app.tenant_id',actor.tenant_id::text,true);PERFORM set_config('app.user_id',actor.id::text,true);
 IF NOT app.has_permission('backup:restore') THEN RAISE EXCEPTION 'Missing backup permission'; END IF;
 original:=app.capture_tenant_backup(actor.tenant_id);
 INSERT INTO tenant_backups(id,tenant_id,created_by,origin,status,schema_signature,payload,pinned)
 VALUES(target,actor.tenant_id,actor.id,'MANUAL','COMPLETED',app.backup_schema_signature(),original,true);
 UPDATE patients SET first_name=first_name||' backup-test' WHERE tenant_id=actor.tenant_id;
 UPDATE expedients SET name=name||' backup-test' WHERE tenant_id=actor.tenant_id;
 PERFORM set_config('app.user_id','',true);
 UPDATE tenants SET name=name||' other-test' WHERE id=other;
 PERFORM set_config('app.user_id',actor.id::text,true);
 SELECT to_jsonb(t) INTO before_b FROM tenants t WHERE id=other;
 INSERT INTO audit_events(tenant_id,user_id,action,entity_type,result,details)
 VALUES(actor.tenant_id,actor.id,'TEST_APPROVAL','BACKUP_TEST','SUCCESS','{"evidence":"must survive"}') RETURNING id INTO event_id;
 SELECT record_hash INTO original_hash FROM audit_events WHERE id=event_id;
 displaced:=app.capture_tenant_backup(actor.tenant_id);
 INSERT INTO tenant_backups(id,tenant_id,created_by,origin,status,schema_signature,payload,pinned)
 VALUES(safety,actor.tenant_id,actor.id,'SAFETY','COMPLETED',app.backup_schema_signature(),displaced,true);
 INSERT INTO tenant_restore_operations(id,tenant_id,backup_id,created_by,safety_backup_id) VALUES(op,actor.tenant_id,target,actor.id,safety);
 BEGIN
  UPDATE expedients SET name='must be blocked' WHERE tenant_id=actor.tenant_id;
  RAISE EXCEPTION 'Maintenance did not block mutation';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 PERFORM app.restore_tenant_backup(op);
 recovered:=app.capture_tenant_backup(actor.tenant_id);
 FOR n IN SELECT app.backup_tables() LOOP
  SELECT jsonb_agg(v ORDER BY v::text) INTO left_rows FROM jsonb_array_elements(original->n) v;
  SELECT jsonb_agg(v ORDER BY v::text) INTO right_rows FROM jsonb_array_elements(recovered->n) v;
  IF left_rows IS DISTINCT FROM right_rows THEN RAISE EXCEPTION 'Snapshot mismatch in %',n; END IF;
 END LOOP;
 SELECT to_jsonb(t) INTO after_b FROM tenants t WHERE id=other;
 IF before_b IS DISTINCT FROM after_b THEN RAISE EXCEPTION 'Other tenant was changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM audit_events WHERE id=event_id) THEN RAISE EXCEPTION 'Audit lost'; END IF;
 IF (SELECT record_hash FROM audit_events WHERE id=event_id) IS DISTINCT FROM original_hash THEN RAISE EXCEPTION 'Audit hash changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tenant_restore_evidence WHERE operation_id=op AND safety_backup_id=safety) THEN RAISE EXCEPTION 'Evidence missing'; END IF;
 IF (SELECT payload FROM tenant_backups WHERE id=safety) IS DISTINCT FROM displaced THEN RAISE EXCEPTION 'Evidence changed'; END IF;
 BEGIN DELETE FROM tenant_restore_evidence WHERE operation_id=op; RAISE EXCEPTION 'Evidence was mutable'; EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN UPDATE tenant_backups SET payload='{}' WHERE id=safety; RAISE EXCEPTION 'Pinned payload was mutable'; EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 IF has_column_privilege('nexodocs_app','public.tenant_backups','payload','SELECT') THEN RAISE EXCEPTION 'Application role can read backup payload directly'; END IF;
 BEGIN UPDATE audit_events SET details='{}' WHERE id=event_id; RAISE EXCEPTION 'Audit was mutable'; EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 PERFORM set_config('app.tenant_id',other::text,true);
 BEGIN PERFORM app.restore_tenant_backup(op); RAISE EXCEPTION 'Cross-tenant access permitted'; EXCEPTION WHEN no_data_found OR SQLSTATE '42501' THEN NULL; END;
 RAISE NOTICE 'PASS: complete operational snapshot, two tenants, maintenance, audit, immutable evidence, cross-tenant denial';
END $$;
ROLLBACK;
