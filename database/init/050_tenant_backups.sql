\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,50);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='050_tenant_backups') AS applied \gset
\if :applied
\else
CREATE TABLE public.tenant_backups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 created_by uuid NOT NULL, origin text NOT NULL CHECK(origin IN ('MANUAL','AUTOMATIC','SAFETY')),
 status text NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED','EXPIRED')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 file_path text, file_size_bytes bigint, checksum text, schema_signature text,
 payload jsonb, error_message text, pinned boolean NOT NULL DEFAULT false,
 FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX ON public.tenant_backups(tenant_id,created_at DESC);
CREATE FUNCTION app.protect_backup_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.pinned AND OLD.status='COMPLETED' AND (TG_OP='DELETE' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)) THEN
  RAISE EXCEPTION 'El respaldo es evidencia protegida' USING ERRCODE='55000';
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER protect_backup_evidence BEFORE UPDATE OR DELETE ON public.tenant_backups FOR EACH ROW EXECUTE FUNCTION app.protect_backup_evidence();
CREATE TABLE public.tenant_backup_settings (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id), enabled boolean NOT NULL DEFAULT true,
 daily_time time NOT NULL DEFAULT '02:00', timezone text NOT NULL DEFAULT 'America/La_Paz',
 retention_days integer NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 365),
 last_run_date date, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.tenant_backup_settings(tenant_id,timezone) SELECT id,timezone FROM tenants;
CREATE TABLE public.tenant_restore_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 backup_id uuid NOT NULL REFERENCES tenant_backups(id), created_by uuid NOT NULL,
 safety_backup_id uuid REFERENCES tenant_backups(id),
 status text NOT NULL DEFAULT 'RUNNING', stage text NOT NULL DEFAULT 'VALIDATING',
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error_message text,
 FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX one_restore_per_tenant ON public.tenant_restore_operations(tenant_id) WHERE status='RUNNING';
-- Permanently retains the exact state displaced by a restore, including immutable clinical/workflow rows.
CREATE TABLE public.tenant_restore_evidence (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 operation_id uuid NOT NULL REFERENCES tenant_restore_operations(id),
 safety_backup_id uuid NOT NULL REFERENCES tenant_backups(id),
 transaction_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_restore_evidence BEFORE UPDATE OR DELETE ON public.tenant_restore_evidence
 FOR EACH ROW EXECUTE FUNCTION app.block_mutation();
INSERT INTO permissions(code,action,module,description) VALUES
 ('backup:read','read','backup','Historial y configuración de la organización'),
 ('backup:create','create','backup','Respaldo completo de la organización'),
 ('backup:download','download','backup','Descarga de datos y archivos completos'),
 ('backup:restore','restore','backup','Recuperar estado conservando evidencia histórica'),
 ('backup:configure','configure','backup','Programación diaria y retención') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
 SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
 WHERE p.module='backup' AND lower(r.name) IN ('administrador de tenant','superadministrador','tenant_admin','super_admin')
 ON CONFLICT DO NOTHING;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tenant_backups','tenant_backup_settings','tenant_restore_operations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON public.%I AS RESTRICTIVE TO nexodocs_app USING (tenant_id=app.current_tenant_id() AND app.context_is_valid()) WITH CHECK(tenant_id=app.current_tenant_id() AND app.context_is_valid())',t);
 EXECUTE format('CREATE POLICY backup_read ON public.%I FOR SELECT TO nexodocs_app USING(app.has_permission(''backup:read''))',t);
 EXECUTE format('GRANT SELECT ON public.%I TO nexodocs_app',t);
 END LOOP;
END $$;

REVOKE SELECT ON public.tenant_backups FROM nexodocs_app;
GRANT SELECT(id,tenant_id,created_by,origin,status,created_at,completed_at,file_size_bytes,checksum,schema_signature,error_message,pinned) ON public.tenant_backups TO nexodocs_app;
CREATE FUNCTION app.backup_tables() RETURNS SETOF text LANGUAGE sql STABLE AS $$
 SELECT c.table_name::text FROM information_schema.columns c
 WHERE c.table_schema='public' AND c.column_name='tenant_id' AND EXISTS(SELECT 1 FROM information_schema.tables b WHERE b.table_schema=c.table_schema AND b.table_name=c.table_name AND b.table_type='BASE TABLE')
 AND c.table_name NOT IN ('audit_events','audit_anchors','backup_history','tenant_backups',
 'tenant_backup_settings','tenant_restore_operations','tenant_restore_evidence',
 'auth_sessions','revoked_access_tokens','password_recovery_requests',
 'billing_transactions','subscription_payments','enterprise_inquiries') ORDER BY c.table_name
$$;
CREATE FUNCTION app.backup_schema_signature() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT md5(string_agg(c.table_name||'.'||c.column_name||':'||c.udt_name,',' ORDER BY c.table_name,c.ordinal_position))
 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name IN (SELECT app.backup_tables())
$$;
-- Proof is created only by the restore function, bound to this exact database transaction.
CREATE FUNCTION app.backup_is_restoring() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.tenant_restore_evidence e WHERE e.id::text=current_setting('app.restore_evidence',true) AND e.transaction_id=txid_current())
$$;
REVOKE ALL ON public.tenant_restore_evidence FROM nexodocs_app;
CREATE FUNCTION app.tenant_backup_maintenance(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.tenant_restore_operations WHERE tenant_id=t AND status='RUNNING')
$$;
CREATE FUNCTION app.backup_lock_writes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t uuid;
BEGIN
 IF app.backup_is_restoring() THEN RETURN COALESCE(NEW,OLD); END IF;
 t:=CASE WHEN TG_TABLE_NAME='tenants' THEN COALESCE((to_jsonb(NEW)->>'id')::uuid,(to_jsonb(OLD)->>'id')::uuid) ELSE COALESCE((to_jsonb(NEW)->>'tenant_id')::uuid,(to_jsonb(OLD)->>'tenant_id')::uuid) END;
 IF t IS NOT NULL THEN
 IF app.tenant_backup_maintenance(t) THEN RAISE EXCEPTION 'Organización en restauración; modificaciones suspendidas' USING ERRCODE='55000'; END IF;
 PERFORM pg_advisory_xact_lock_shared(726396,hashtext(t::text)); END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
-- Defer FK checks only inside the restore transaction; normal operations remain immediate.
DO $$ DECLARE r record; d text; BEGIN
 FOR r IN SELECT oid,conname,conrelid::regclass AS tbl FROM pg_constraint WHERE contype='f' AND conrelid IN
 (SELECT ('public.'||t)::regclass FROM app.backup_tables() t) LOOP
 d:=pg_get_constraintdef(r.oid);
 d:=replace(d,'ON DELETE RESTRICT','ON DELETE NO ACTION');
 EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.tbl,r.conname);
 EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s DEFERRABLE INITIALLY IMMEDIATE',r.tbl,r.conname,regexp_replace(d,' DEFERRABLE.*$','','i'));
 END LOOP;
 -- Preserve all normal trigger behaviour. A transaction-bound evidence record permits only
 -- the controlled recovery path; audit_events and restore evidence are NEVER exempted.
 FOR r IN SELECT DISTINCT p.oid FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND t.tgrelid IN(SELECT ('public.'||n)::regclass FROM app.backup_tables() n)
 AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql') LOOP
 d:=pg_get_functiondef(r.oid);
 d:=regexp_replace(d,'\mBEGIN\M',E'BEGIN\n IF app.backup_is_restoring() AND TG_TABLE_NAME NOT IN (''audit_events'',''tenant_restore_evidence'') THEN RETURN COALESCE(NEW,OLD); END IF;', 'i');
 EXECUTE d;
 END LOOP;
 FOR r IN SELECT app.backup_tables() AS tbl LOOP
 EXECUTE format('CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes()',r.tbl);
 END LOOP;
END $$;

CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes();
CREATE FUNCTION app.capture_tenant_backup(t uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n text; rows jsonb; result jsonb:='{}';
BEGIN
 IF t IS DISTINCT FROM app.current_tenant_id() OR NOT app.has_permission('backup:create') THEN RAISE EXCEPTION 'Respaldo no autorizado' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(726396,hashtext(t::text));
 FOR n IN SELECT app.backup_tables() LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM public.%I x WHERE tenant_id=$1',n) INTO rows USING t;
 result:=result||jsonb_build_object(n,rows);
 END LOOP;
 SELECT result||jsonb_build_object('_tenant',to_jsonb(x)) INTO result FROM public.tenants x WHERE id=t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app.capture_tenant_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.capture_tenant_backup(uuid) TO nexodocs_app;

CREATE FUNCTION app.restore_tenant_backup(op uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operation public.tenant_restore_operations; b public.tenant_backups; n text; cols text; assignments text; evidence uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT operation FROM public.tenant_restore_operations WHERE id=op AND tenant_id=app.current_tenant_id() AND status='RUNNING';
 IF NOT app.has_permission('backup:restore') THEN RAISE EXCEPTION 'Restauración no autorizada' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(726396,hashtext(operation.tenant_id::text));
 SELECT * INTO STRICT b FROM public.tenant_backups WHERE id=operation.backup_id AND tenant_id=operation.tenant_id AND status='COMPLETED';
 IF b.schema_signature<>app.backup_schema_signature() THEN RAISE EXCEPTION 'Esquema incompatible'; END IF;
 FOR n IN SELECT app.backup_tables() LOOP
 IF NOT b.payload ? n OR jsonb_typeof(b.payload->n)<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload->n) v WHERE (v->>'tenant_id')::uuid IS DISTINCT FROM operation.tenant_id) THEN RAISE EXCEPTION 'Contenido del respaldo fuera de alcance'; END IF;
 END LOOP;
 IF operation.safety_backup_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenant_backups WHERE id=operation.safety_backup_id AND pinned AND status='COMPLETED' AND tenant_id=operation.tenant_id) THEN RAISE EXCEPTION 'Falta respaldo de seguridad'; END IF;
 INSERT INTO public.tenant_restore_evidence(id,tenant_id,operation_id,safety_backup_id,transaction_id) VALUES(evidence,operation.tenant_id,op,operation.safety_backup_id,txid_current());
 PERFORM set_config('app.restore_evidence',evidence::text,true);
 SET CONSTRAINTS ALL DEFERRED;
 FOR n IN SELECT x FROM app.backup_tables() x WHERE x<>'users' LOOP
 EXECUTE format('DELETE FROM public.%I WHERE tenant_id=$1',n) USING operation.tenant_id;
 END LOOP;
 -- Retain identities referenced by audit, but deactivate users absent from the snapshot.
 UPDATE public.users SET deleted_at=now() WHERE tenant_id=operation.tenant_id AND id NOT IN(SELECT (v->>'id')::uuid FROM jsonb_array_elements(b.payload->'users') v);
 FOR n IN SELECT app.backup_tables() LOOP
 SELECT string_agg(quote_ident(column_name),',' ORDER BY ordinal_position),string_agg(format('%I=EXCLUDED.%I',column_name,column_name),',' ORDER BY ordinal_position) FILTER(WHERE column_name NOT IN('id','tenant_id') AND (n<>'users' OR column_name<>'password_hash'))
 INTO cols,assignments FROM information_schema.columns WHERE table_schema='public' AND table_name=n AND is_generated='NEVER';
 IF n='users' THEN
 EXECUTE format('INSERT INTO public.users(%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::public.users,$1) ON CONFLICT(id) DO UPDATE SET %s',cols,cols,assignments) USING b.payload->n;
 ELSE
 EXECUTE format('INSERT INTO public.%I(%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::public.%I,$1)',n,cols,cols,n) USING b.payload->n;
 END IF;
 END LOOP;
 UPDATE public.tenants SET name=b.payload->'_tenant'->>'name',email=b.payload->'_tenant'->>'email',phone=b.payload->'_tenant'->>'phone',address=b.payload->'_tenant'->>'address',settings=b.payload->'_tenant'->'settings',logo_url=b.payload->'_tenant'->>'logo_url',primary_color=b.payload->'_tenant'->>'primary_color',currency=b.payload->'_tenant'->>'currency',timezone=b.payload->'_tenant'->>'timezone',date_format=b.payload->'_tenant'->>'date_format',default_language=b.payload->'_tenant'->>'default_language' WHERE id=operation.tenant_id;
 SET CONSTRAINTS ALL IMMEDIATE;
 PERFORM set_config('app.restore_evidence','',true);
 UPDATE public.tenant_restore_operations SET status='COMPLETED',stage='COMPLETED',completed_at=now() WHERE id=op;
END $$;
REVOKE ALL ON FUNCTION app.restore_tenant_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.restore_tenant_backup(uuid) TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES('050_tenant_backups');
\endif
COMMIT;
