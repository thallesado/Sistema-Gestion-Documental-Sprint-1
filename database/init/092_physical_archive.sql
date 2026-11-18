\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394,92);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='092_physical_archive') AS already_applied \gset
\if :already_applied
  \echo '092_physical_archive ya aplicada'
\else
INSERT INTO permissions(code,action,module,description) VALUES
 ('physical:read','read','physical','Consultar originales y custodia'),
 ('physical:manage','manage','physical','Administrar ubicaciones y originales'),
 ('physical:request','request','physical','Solicitar originales físicos'),
 ('physical:approve','approve','physical','Reservar o rechazar préstamos'),
 ('physical:handover','handover','physical','Confirmar entrega física'),
 ('physical:return','return','physical','Recibir devoluciones y resolver incidencias') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
 SELECT DISTINCT rp.tenant_id,rp.role_id,p.id FROM role_permissions rp
 JOIN permissions a ON a.id=rp.permission_id AND a.code='backup:configure'
 CROSS JOIN permissions p WHERE p.module='physical' ON CONFLICT DO NOTHING;

CREATE TABLE physical_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 parent_id uuid, name varchar(150) NOT NULL CHECK(length(btrim(name))>0), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,parent_id) REFERENCES physical_locations(tenant_id,id), CHECK(parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX physical_location_unique ON physical_locations(tenant_id,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
CREATE TABLE physical_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(60) NOT NULL CHECK(length(btrim(code))>0), name varchar(255) NOT NULL CHECK(length(btrim(name))>0),
 location_id uuid NOT NULL, custodian_id uuid NOT NULL,
 document_id uuid, expedient_id uuid,
 condition text NOT NULL DEFAULT 'Completo' CHECK(length(condition) BETWEEN 1 AND 1000),
 status varchar(35) NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN('AVAILABLE','RESERVED','ON_LOAN','INCIDENT','RECONCILIATION_REQUIRED','WITHDRAWN')),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,code),
 FOREIGN KEY(tenant_id,location_id) REFERENCES physical_locations(tenant_id,id),
 FOREIGN KEY(tenant_id,custodian_id) REFERENCES users(tenant_id,id)
 -- Digital references are validated on write, not FKs: a logical restore may remove the digital counterpart,
 -- while real physical custody MUST survive. The UI reports missing links instead of deleting custody.
);
CREATE TABLE physical_loans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), item_id uuid NOT NULL,
 requested_by uuid NOT NULL, reason varchar(1000) NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 1000),
 due_at timestamptz NOT NULL, reserved_until timestamptz,
 status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','RESERVED','REJECTED','CANCELLED','HANDED_OVER','RETURNED')),
 approved_by uuid, handed_by uuid, returned_by uuid, handed_at timestamptz, returned_at timestamptz,
 return_condition varchar(1000), decision_reason varchar(1000), reminder_date date,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,item_id) REFERENCES physical_items(tenant_id,id),
 FOREIGN KEY(tenant_id,requested_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX physical_one_active_loan ON physical_loans(tenant_id,item_id) WHERE status IN('RESERVED','HANDED_OVER');
CREATE TABLE physical_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 item_id uuid NOT NULL, loan_id uuid, actor_id uuid NOT NULL, action varchar(40) NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,item_id) REFERENCES physical_items(tenant_id,id)
);
CREATE TRIGGER physical_movements_immutable BEFORE UPDATE OR DELETE ON physical_movements
 FOR EACH ROW EXECUTE FUNCTION app.block_mutation();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['physical_locations','physical_items','physical_loans','physical_movements'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE TO nexodocs_app USING(tenant_id=app.current_tenant_id() AND app.context_is_valid()) WITH CHECK(tenant_id=app.current_tenant_id() AND app.context_is_valid())',t);
  EXECUTE format('CREATE POLICY physical_read ON %I FOR SELECT TO nexodocs_app USING(app.has_permission(''physical:read''))',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO nexodocs_app',t);
  EXECUTE format('CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes()',t);
 END LOOP;
END $$;
GRANT UPDATE,DELETE ON physical_locations TO nexodocs_app;
GRANT UPDATE ON physical_items,physical_loans TO nexodocs_app;
CREATE POLICY physical_location_write ON physical_locations FOR ALL TO nexodocs_app USING(app.has_permission('physical:manage')) WITH CHECK(app.has_permission('physical:manage'));
CREATE POLICY physical_item_create ON physical_items FOR INSERT TO nexodocs_app WITH CHECK(app.has_permission('physical:manage'));
CREATE POLICY physical_item_update ON physical_items FOR UPDATE TO nexodocs_app USING(app.has_permission('physical:manage') OR app.has_permission('physical:approve') OR app.has_permission('physical:handover') OR app.has_permission('physical:return'));
CREATE POLICY physical_loan_create ON physical_loans FOR INSERT TO nexodocs_app WITH CHECK(app.has_permission('physical:request') AND requested_by=app.current_user_id());
CREATE POLICY physical_loan_update ON physical_loans FOR UPDATE TO nexodocs_app USING(app.has_permission('physical:approve') OR app.has_permission('physical:handover') OR app.has_permission('physical:return') OR (app.has_permission('physical:request') AND requested_by=app.current_user_id()));
CREATE POLICY physical_movement_create ON physical_movements FOR INSERT TO nexodocs_app WITH CHECK(actor_id=app.current_user_id() AND (app.has_permission('physical:manage') OR app.has_permission('physical:request') OR app.has_permission('physical:approve') OR app.has_permission('physical:handover') OR app.has_permission('physical:return')));

-- Preserve real custody across a logical rollback. Full host backups still contain these tables.
GRANT SELECT,INSERT,UPDATE ON physical_locations,physical_items,physical_loans,physical_movements TO nexodocs_platform_admin;
ALTER FUNCTION app.backup_tables() RENAME TO backup_tables_before_physical;
CREATE FUNCTION app.backup_tables() RETURNS SETOF text LANGUAGE sql STABLE AS $$
 SELECT x FROM app.backup_tables_before_physical() x WHERE x NOT IN('physical_locations','physical_items','physical_loans','physical_movements')
$$;
CREATE FUNCTION app.physical_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='physical_items' THEN
  IF NEW.document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.document_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE='23514'; END IF;
  IF NEW.expedient_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM expedients WHERE tenant_id=NEW.tenant_id AND id=NEW.expedient_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Expediente no disponible' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM app.physical_people() WHERE id=NEW.custodian_id) THEN RAISE EXCEPTION 'Custodio no disponible' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_item_guard BEFORE INSERT OR UPDATE OF document_id,expedient_id,custodian_id ON physical_items FOR EACH ROW EXECUTE FUNCTION app.physical_guard();
CREATE FUNCTION app.physical_people() RETURNS TABLE(id uuid,display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT u.id,concat_ws(' ',u.first_name,u.last_name) FROM users u
 WHERE u.tenant_id=app.current_tenant_id() AND u.status='ACTIVE' AND u.deleted_at IS NULL
 AND app.has_permission('physical:read') ORDER BY u.first_name,u.last_name
$$;
ALTER FUNCTION app.physical_people() OWNER TO nexodocs_platform_admin;
REVOKE ALL ON FUNCTION app.physical_people() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.physical_people() TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES('092_physical_archive');
\endif
COMMIT;
