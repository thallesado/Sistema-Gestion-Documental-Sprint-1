\set ON_ERROR_STOP on
-- Migración incremental: sirve tanto para volúmenes nuevos como existentes.
-- Ejecutar con psql como propietario/migrador, nunca como nexodocs_app.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 4);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app.schema_migrations FROM PUBLIC, nexodocs_app;
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '004_saas_hardening') AS already_applied \gset
\if :already_applied
  \echo '004_saas_hardening ya aplicada'
\else

-- Las nuevas restricciones validan también los datos existentes. Cualquier
-- incompatibilidad aborta TODA la migración; no se borran registros para corregirla.
ALTER TABLE users ADD CONSTRAINT ck_users_platform_separation CHECK (
  (tenant_id IS NULL AND is_platform_admin AND department_id IS NULL)
  OR (tenant_id IS NOT NULL AND NOT is_platform_admin)
);
CREATE UNIQUE INDEX uq_users_tenant_email_normalized ON users(tenant_id, lower(btrim(email))) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX uq_users_tenant_username_normalized ON users(tenant_id, lower(btrim(username))) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_users_username ON users(lower(btrim(username))) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX uq_platform_users_email_normalized ON users(lower(btrim(email))) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX uq_tenants_slug_normalized ON tenants(lower(btrim(slug)));
ALTER TABLE users ADD CONSTRAINT ck_users_identity_nonempty CHECK (btrim(email) <> '' AND btrim(username) <> '');
ALTER TABLE tenants ADD CONSTRAINT ck_tenants_slug_nonempty CHECK (btrim(slug) <> '');
ALTER TABLE tenants ADD CONSTRAINT ck_tenants_subscription_dates CHECK (subscription_end_date IS NULL OR subscription_start_date IS NULL OR subscription_end_date >= subscription_start_date);
ALTER TABLE documents ADD CONSTRAINT ck_documents_labels CHECK (btrim(code) <> '' AND btrim(name) <> '');
ALTER TABLE document_versions ADD CONSTRAINT ck_version_reason CHECK (btrim(change_reason) <> '');
ALTER TABLE workflow_templates ADD CONSTRAINT ck_template_version CHECK (version > 0);
-- Se conserva assignment_reference como texto legado, pero las asignaciones
-- nuevas y las referencias reales se validan mediante columnas tipadas y FK.
ALTER TABLE workflow_template_stages ADD COLUMN assigned_user_id uuid, ADD COLUMN assigned_role_id bigint, ADD COLUMN assigned_department_id uuid, ADD COLUMN assigned_group_id uuid;
UPDATE workflow_template_stages s SET assigned_user_id = u.id FROM users u WHERE s.tenant_id = u.tenant_id AND s.assignment_type = 'USER' AND s.assignment_reference IN (u.id::text, u.username);
UPDATE workflow_template_stages s SET assigned_role_id = r.id FROM roles r WHERE s.tenant_id = r.tenant_id AND s.assignment_type = 'ROLE' AND s.assignment_reference IN (r.id::text, r.name);
UPDATE workflow_template_stages s SET assigned_department_id = d.id FROM tenant_departments d WHERE s.tenant_id = d.tenant_id AND s.assignment_type = 'DEPARTMENT' AND s.assignment_reference IN (d.id::text, d.code);
UPDATE workflow_template_stages s SET assigned_group_id = g.id FROM user_groups g WHERE s.tenant_id = g.tenant_id AND s.assignment_type = 'GROUP' AND s.assignment_reference IN (g.id::text, g.name);
ALTER TABLE workflow_template_stages ADD CONSTRAINT fk_stage_assigned_user FOREIGN KEY (tenant_id, assigned_user_id) REFERENCES users(tenant_id, id);
ALTER TABLE workflow_template_stages ADD CONSTRAINT fk_stage_assigned_role FOREIGN KEY (tenant_id, assigned_role_id) REFERENCES roles(tenant_id, id);
ALTER TABLE workflow_template_stages ADD CONSTRAINT fk_stage_assigned_department FOREIGN KEY (tenant_id, assigned_department_id) REFERENCES tenant_departments(tenant_id, id);
ALTER TABLE workflow_template_stages ADD CONSTRAINT fk_stage_assigned_group FOREIGN KEY (tenant_id, assigned_group_id) REFERENCES user_groups(tenant_id, id);
ALTER TABLE workflow_template_stages ADD CONSTRAINT ck_stage_typed_assignment CHECK (
  (assignment_type IS NULL AND assignment_reference IS NULL AND num_nonnulls(assigned_user_id, assigned_role_id, assigned_department_id, assigned_group_id) = 0)
  OR (num_nonnulls(assigned_user_id, assigned_role_id, assigned_department_id, assigned_group_id) = 1 AND
    CASE assignment_type WHEN 'USER' THEN assigned_user_id IS NOT NULL WHEN 'ROLE' THEN assigned_role_id IS NOT NULL
      WHEN 'DEPARTMENT' THEN assigned_department_id IS NOT NULL WHEN 'GROUP' THEN assigned_group_id IS NOT NULL ELSE false END)
);
ALTER TABLE workflow_template_stages ADD CONSTRAINT ck_stage_order CHECK (sort_order >= 0);
ALTER TABLE clinical_document_links ADD CONSTRAINT ck_clinical_episode_history CHECK (episode_id IS NULL OR clinical_history_id IS NOT NULL);
ALTER TABLE clinical_episodes ADD CONSTRAINT ck_episode_dates CHECK (ended_at IS NULL OR ended_at >= started_at);
ALTER TABLE workflows ADD CONSTRAINT ck_workflow_dates CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);
ALTER TABLE workflow_tasks ADD CONSTRAINT ck_task_dates CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);
ALTER TABLE workflow_tasks ADD CONSTRAINT ck_task_completion CHECK (
  (status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_by IS NOT NULL)
  OR (status <> 'COMPLETED' AND completed_at IS NULL AND completed_by IS NULL AND outcome IS NULL)
);
ALTER TABLE notifications ADD CONSTRAINT ck_notification_read CHECK (is_read = (read_at IS NOT NULL));
ALTER TABLE ocr_jobs ADD CONSTRAINT ck_ocr_page_progress CHECK (pages_total IS NULL OR pages_processed <= pages_total);
ALTER TABLE ocr_jobs ADD CONSTRAINT ck_ocr_human_validation CHECK (status NOT IN ('VALIDATED','INDEXED') OR (validated_by IS NOT NULL AND validated_at IS NOT NULL));
-- Un administrador global no es un usuario del tenant intervenido. Ambos actores
-- se conservan separados para no romper la FK compuesta ni falsear la identidad.
ALTER TABLE audit_events ADD COLUMN platform_actor_id uuid REFERENCES users(id);
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_user_exists FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE audit_events ADD CONSTRAINT ck_audit_one_actor CHECK (num_nonnulls(user_id, platform_actor_id) <= 1);

-- Formas JSON mínimas; la validación de esquemas/metadatos de negocio corresponde
-- además al backend. No se impone una estructura clínica al núcleo general.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('tenants','settings','object'), ('document_types','metadata_schema','object'),
    ('expedient_types','metadata_schema','object'), ('expedients','metadata','object'),
    ('metadata_definitions','options','array'), ('workflow_template_stages','rules','object'),
    ('workflow_template_transitions','condition','object'), ('workflow_events','details','object'),
    ('audit_events','details','object'), ('ocr_jobs','extracted_data','object'),
    ('ocr_jobs','suggested_metadata','object'), ('report_templates','selected_fields','array'),
    ('report_templates','filters','array'), ('report_templates','sort_config','array'),
    ('clinical_histories','allergies','array'), ('clinical_histories','current_medications','array')
  ) AS shapes(table_name, column_name, json_type) LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (jsonb_typeof(%I) = %L)',
      r.table_name, 'ck_' || r.table_name || '_' || r.column_name, r.column_name, r.json_type);
  END LOOP;
END;
$$;

-- Relaciones dentro del mismo agregado, además de pertenecer al mismo tenant.
ALTER TABLE document_comments ADD CONSTRAINT uq_comments_document UNIQUE (tenant_id, document_id, id);
ALTER TABLE document_comments ADD CONSTRAINT fk_comment_parent_document FOREIGN KEY (tenant_id, document_id, parent_id) REFERENCES document_comments(tenant_id, document_id, id);
ALTER TABLE document_comments ADD CONSTRAINT ck_comment_not_self CHECK (parent_id IS NULL OR parent_id <> id);
ALTER TABLE workflows ADD CONSTRAINT uq_workflows_template UNIQUE (tenant_id, id, workflow_template_id);
ALTER TABLE workflows ADD CONSTRAINT ck_workflow_stage_template CHECK (current_stage_id IS NULL OR workflow_template_id IS NOT NULL);
ALTER TABLE workflows ADD CONSTRAINT fk_workflow_current_template_stage FOREIGN KEY (tenant_id, workflow_template_id, current_stage_id) REFERENCES workflow_template_stages(tenant_id, workflow_template_id, id);
ALTER TABLE workflow_tasks ADD COLUMN workflow_template_id uuid;
UPDATE workflow_tasks t SET workflow_template_id = w.workflow_template_id FROM workflows w WHERE w.tenant_id = t.tenant_id AND w.id = t.workflow_id;
ALTER TABLE workflow_tasks ADD CONSTRAINT uq_tasks_workflow UNIQUE (tenant_id, workflow_id, id);
ALTER TABLE workflow_tasks ADD CONSTRAINT fk_task_workflow_template FOREIGN KEY (tenant_id, workflow_id, workflow_template_id) REFERENCES workflows(tenant_id, id, workflow_template_id);
ALTER TABLE workflow_tasks ADD CONSTRAINT ck_task_stage_template CHECK (stage_id IS NULL OR workflow_template_id IS NOT NULL);
ALTER TABLE workflow_tasks ADD CONSTRAINT fk_task_template_stage FOREIGN KEY (tenant_id, workflow_template_id, stage_id) REFERENCES workflow_template_stages(tenant_id, workflow_template_id, id);
ALTER TABLE workflow_events ADD CONSTRAINT fk_event_workflow_task FOREIGN KEY (tenant_id, workflow_id, task_id) REFERENCES workflow_tasks(tenant_id, workflow_id, id);
ALTER TABLE workflow_comments ADD CONSTRAINT fk_comment_workflow_task FOREIGN KEY (tenant_id, workflow_id, task_id) REFERENCES workflow_tasks(tenant_id, workflow_id, id);
ALTER TABLE workflow_documents ADD CONSTRAINT uq_workflow_documents_scope UNIQUE (tenant_id, workflow_id, document_id);
ALTER TABLE workflow_tasks ADD CONSTRAINT fk_task_workflow_document FOREIGN KEY (tenant_id, workflow_id, document_id) REFERENCES workflow_documents(tenant_id, workflow_id, document_id);
ALTER TABLE workflow_events ADD CONSTRAINT fk_event_workflow_document FOREIGN KEY (tenant_id, workflow_id, document_id) REFERENCES workflow_documents(tenant_id, workflow_id, document_id);
ALTER TABLE workflow_comments ADD CONSTRAINT fk_comment_workflow_document FOREIGN KEY (tenant_id, workflow_id, document_id) REFERENCES workflow_documents(tenant_id, workflow_id, document_id);

CREATE FUNCTION app.set_task_template() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  SELECT w.workflow_template_id INTO NEW.workflow_template_id
    FROM public.workflows w WHERE w.tenant_id = NEW.tenant_id AND w.id = NEW.workflow_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow no disponible' USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_task_template BEFORE INSERT OR UPDATE ON workflow_tasks FOR EACH ROW EXECUTE FUNCTION app.set_task_template();

-- Versionado serializado por documento. NULL significa que aún no hay contenido.
-- Se reconstruye solo la proyección current_version; el historial no se modifica.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM document_versions GROUP BY tenant_id, document_id HAVING min(version_number) <> 1 OR count(*) <> max(version_number)) THEN
    RAISE EXCEPTION 'Historial con huecos: revisar document_versions antes de migrar' USING ERRCODE = '23514';
  END IF;
END;
$$;
ALTER TABLE documents ALTER COLUMN current_version DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN current_version DROP DEFAULT;
UPDATE documents d SET current_version = (SELECT max(v.version_number) FROM document_versions v WHERE v.tenant_id = d.tenant_id AND v.document_id = d.id)
WHERE d.current_version IS DISTINCT FROM (SELECT max(v.version_number) FROM document_versions v WHERE v.tenant_id = d.tenant_id AND v.document_id = d.id);
ALTER TABLE document_versions ADD CONSTRAINT uq_version_tenant_document_number UNIQUE (tenant_id, document_id, version_number);
ALTER TABLE documents ADD CONSTRAINT fk_document_current_version FOREIGN KEY (tenant_id, id, current_version) REFERENCES document_versions(tenant_id, document_id, version_number) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE workflow_tasks ADD CONSTRAINT ck_task_document_version CHECK (document_version IS NULL OR (document_id IS NOT NULL AND document_version > 0));
ALTER TABLE workflow_tasks ADD CONSTRAINT fk_task_document_version FOREIGN KEY (tenant_id, document_id, document_version) REFERENCES document_versions(tenant_id, document_id, version_number);

CREATE FUNCTION app.prepare_document_version() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE latest integer; document_state public.document_status; removed_at timestamptz;
BEGIN
  SELECT d.current_version, d.status, d.deleted_at INTO latest, document_state, removed_at FROM public.documents d WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE = '23503'; END IF;
  IF document_state IN ('ARCHIVED','VOIDED','TRASHED') OR removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reabrir el documento antes de agregar contenido' USING ERRCODE = '23514';
  END IF;
  SELECT max(v.version_number) INTO latest FROM public.document_versions v WHERE v.tenant_id = NEW.tenant_id AND v.document_id = NEW.document_id;
  NEW.version_number := coalesce(NEW.version_number, coalesce(latest, 0) + 1);
  IF NEW.version_number <> coalesce(latest, 0) + 1 THEN
    RAISE EXCEPTION 'Versión desactualizada: se esperaba %', coalesce(latest, 0) + 1 USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION app.advance_document_version() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- Una aprobación previa no aprueba automáticamente contenido nuevo.
  UPDATE public.documents SET current_version = NEW.version_number,
    status = CASE WHEN NEW.version_number > 1 THEN 'DRAFT'::public.document_status ELSE status END
    WHERE tenant_id = NEW.tenant_id AND id = NEW.document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar el documento' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION app.validate_current_version() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE current_row record; latest integer;
BEGIN
  SELECT d.current_version, d.status INTO current_row FROM public.documents d WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT max(v.version_number) INTO latest FROM public.document_versions v WHERE v.tenant_id = NEW.tenant_id AND v.document_id = NEW.id;
  IF current_row.current_version IS DISTINCT FROM latest OR (latest IS NULL AND current_row.status NOT IN ('DRAFT','PENDING','TRASHED')) THEN
    RAISE EXCEPTION 'current_version debe reflejar la última versión; un documento publicado necesita contenido' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_version_prepare BEFORE INSERT ON document_versions FOR EACH ROW EXECUTE FUNCTION app.prepare_document_version();
CREATE TRIGGER trg_version_advance AFTER INSERT ON document_versions FOR EACH ROW EXECUTE FUNCTION app.advance_document_version();
CREATE CONSTRAINT TRIGGER trg_document_current_version AFTER INSERT OR UPDATE ON documents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.validate_current_version();
-- Valida también el estado preexistente que el trigger diferido no alcanzaría.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM documents WHERE current_version IS NULL AND status NOT IN ('DRAFT','PENDING','TRASHED')) THEN
    RAISE EXCEPTION 'Existen documentos publicados sin versiones' USING ERRCODE = '23514';
  END IF;
END $$;

-- Una plantilla utilizada pasa a ser una versión histórica. Crear otra versión
-- de plantilla para cambiar etapas/reglas. Los locks evitan carreras al iniciar.
CREATE FUNCTION app.lock_workflow_template() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF NEW.workflow_template_id IS NOT NULL THEN
    PERFORM 1 FROM public.workflow_templates WHERE tenant_id = NEW.tenant_id AND id = NEW.workflow_template_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plantilla no disponible' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_workflow_template_lock BEFORE INSERT OR UPDATE OF workflow_template_id ON workflows FOR EACH ROW EXECUTE FUNCTION app.lock_workflow_template();
CREATE FUNCTION app.protect_used_template() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE template_id uuid; scope_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'workflow_templates' THEN
    template_id := OLD.id; scope_id := OLD.tenant_id;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['is_active','updated_at']) = (to_jsonb(OLD) - ARRAY['is_active','updated_at']) THEN RETURN NEW; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN template_id := NEW.workflow_template_id; scope_id := NEW.tenant_id;
    ELSE template_id := OLD.workflow_template_id; scope_id := OLD.tenant_id; END IF;
    IF TG_OP = 'UPDATE' AND NEW.workflow_template_id <> OLD.workflow_template_id THEN
      RAISE EXCEPTION 'No se permite trasladar etapas/transiciones a otra plantilla' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM public.workflow_templates WHERE tenant_id = scope_id AND id = template_id FOR UPDATE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.workflows WHERE tenant_id = scope_id AND workflow_template_id = template_id) THEN
    RAISE EXCEPTION 'Plantilla utilizada: crear una nueva versión antes de editarla' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_used_template BEFORE UPDATE OR DELETE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION app.protect_used_template();
CREATE TRIGGER trg_used_template_stage BEFORE INSERT OR UPDATE OR DELETE ON workflow_template_stages FOR EACH ROW EXECUTE FUNCTION app.protect_used_template();
CREATE TRIGGER trg_used_template_transition BEFORE INSERT OR UPDATE OR DELETE ON workflow_template_transitions FOR EACH ROW EXECUTE FUNCTION app.protect_used_template();

-- Identidad y tenant no pueden reescribirse. Tampoco TRUNCATE puede saltarse los
-- triggers de UPDATE/DELETE de las tablas históricas.
CREATE FUNCTION app.protect_row_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF (to_jsonb(NEW)->'tenant_id') IS DISTINCT FROM (to_jsonb(OLD)->'tenant_id') OR (to_jsonb(NEW)->'id') IS DISTINCT FROM (to_jsonb(OLD)->'id') THEN
    RAISE EXCEPTION 'La identidad y el tenant de una fila son inmutables' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION app.block_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN RAISE EXCEPTION '% es append-only: no se permite %', TG_TABLE_NAME, TG_OP USING ERRCODE = '55000'; END;
$$;
DO $$
DECLARE r record; t text;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenant_id' LOOP
    EXECUTE format('CREATE TRIGGER trg_scope_identity BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity()', r.table_name);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['document_versions','audit_events','workflow_events'] LOOP
    EXECUTE format('CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION app.block_mutation()', t);
  END LOOP;
END;
$$;
CREATE TRIGGER trg_tenant_identity BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION app.protect_row_identity();

-- Índices para navegación por cursor, vencimientos y colas de cada tenant.
CREATE INDEX idx_documents_page ON documents(tenant_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_author_page ON documents(tenant_id, author_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_expiry ON documents(tenant_id, expiry_date, id) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND status NOT IN ('ARCHIVED','VOIDED','TRASHED');
CREATE INDEX idx_expedients_page ON expedients(tenant_id, status, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_template ON workflows(tenant_id, workflow_template_id);
CREATE INDEX idx_workflows_page ON workflows(tenant_id, created_at DESC, id DESC);
CREATE INDEX idx_workflow_tasks_role_queue ON workflow_tasks(tenant_id, assigned_role_id, due_at, id) WHERE assigned_role_id IS NOT NULL AND status IN ('PENDING','IN_PROGRESS','OVERDUE');
CREATE INDEX idx_workflow_tasks_department_queue ON workflow_tasks(tenant_id, assigned_department_id, due_at, id) WHERE assigned_department_id IS NOT NULL AND status IN ('PENDING','IN_PROGRESS','OVERDUE');
CREATE INDEX idx_workflow_tasks_group_queue ON workflow_tasks(tenant_id, assigned_group_id, due_at, id) WHERE assigned_group_id IS NOT NULL AND status IN ('PENDING','IN_PROGRESS','OVERDUE');
CREATE INDEX idx_workflow_events_timeline ON workflow_events(tenant_id, workflow_id, performed_at, id);
CREATE INDEX idx_ocr_queue ON ocr_jobs(tenant_id, status, created_at, id) WHERE status IN ('QUEUED','PROCESSING','REQUIRES_VALIDATION');
CREATE INDEX idx_document_tags_reverse ON document_tags(tenant_id, tag_id, document_id);
CREATE INDEX idx_document_comments_timeline ON document_comments(tenant_id, document_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_metadata_definition ON document_metadata_values(tenant_id, metadata_definition_id, document_id);
CREATE INDEX idx_user_roles_scope ON user_roles(tenant_id, user_id, role_id);
CREATE INDEX idx_role_permissions_scope ON role_permissions(tenant_id, role_id, permission_id);
CREATE INDEX idx_group_members_user ON user_group_members(tenant_id, user_id, group_id);
CREATE INDEX idx_clinical_links_patient ON clinical_document_links(tenant_id, patient_id, document_id);
CREATE INDEX idx_dicom_series_study ON dicom_series(tenant_id, study_id);

-- Rol interno sin login ni membresía del backend. BYPASSRLS se limita a funciones
-- de consulta de autorización y escritura de auditoría con search_path fijo.
DO $$ BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexodocs_security') THEN
      CREATE ROLE nexodocs_security NOLOGIN NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
    ALTER ROLE nexodocs_app NOLOGIN NOCREATEDB NOCREATEROLE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping role attributes that require superuser: %', SQLERRM;
  END;
END $$;
GRANT nexodocs_security TO CURRENT_USER;
DO $$ BEGIN
  BEGIN
    REVOKE nexodocs_platform_admin, nexodocs_security FROM nexodocs_app;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
REVOKE CREATE ON SCHEMA public, app FROM PUBLIC, nexodocs_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public, app TO nexodocs_security;
GRANT SELECT (id, tenant_id, status, deleted_at, is_platform_admin) ON users TO nexodocs_security;
GRANT SELECT (id, subscription_status) ON tenants TO nexodocs_security;
GRANT SELECT ON roles, user_roles, permissions, role_permissions TO nexodocs_security;
GRANT SELECT ON documents, document_versions, workflows, workflow_templates TO nexodocs_security;
GRANT UPDATE (id) ON workflows, workflow_templates TO nexodocs_security;
GRANT INSERT ON audit_events TO nexodocs_security;
GRANT USAGE ON SEQUENCE audit_events_id_seq TO nexodocs_security;

-- Las comprobaciones de integridad deben ver también filas que el actor no puede
-- consultar; de lo contrario RLS podría ocultar una referencia y omitir el control.
ALTER FUNCTION app.validate_current_version() SECURITY DEFINER;
ALTER FUNCTION app.validate_current_version() OWNER TO nexodocs_security;
ALTER FUNCTION app.protect_used_template() SECURITY DEFINER;
ALTER FUNCTION app.protect_used_template() OWNER TO nexodocs_security;
ALTER FUNCTION app.lock_workflow_template() SECURITY DEFINER;
ALTER FUNCTION app.lock_workflow_template() OWNER TO nexodocs_security;
ALTER FUNCTION app.set_task_template() SECURITY DEFINER;
ALTER FUNCTION app.set_task_template() OWNER TO nexodocs_security;

CREATE FUNCTION app.current_user_id() RETURNS uuid LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
CREATE FUNCTION app.context_is_valid() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = app.current_user_id() AND u.tenant_id = app.current_tenant_id()
      AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_platform_admin
      AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
  )
$$;
CREATE FUNCTION app.has_permission(permission_code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT app.context_is_valid() AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active
    WHERE ur.tenant_id = app.current_tenant_id() AND ur.user_id = app.current_user_id() AND p.code = permission_code
  )
$$;
ALTER FUNCTION app.context_is_valid() OWNER TO nexodocs_security;
ALTER FUNCTION app.has_permission(text) OWNER TO nexodocs_security;
GRANT EXECUTE ON FUNCTION app.current_tenant_id(), app.current_user_id(), app.context_is_valid(), app.has_permission(text) TO nexodocs_app, nexodocs_security, nexodocs_platform_admin;
CREATE FUNCTION app.validate_audit_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF NEW.platform_actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.platform_actor_id AND tenant_id IS NULL AND is_platform_admin) THEN
    RAISE EXCEPTION 'platform_actor_id debe identificar a un administrador global' USING ERRCODE = '23514';
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND tenant_id IS NULL AND is_platform_admin) THEN
    RAISE EXCEPTION 'Un actor de tenant no puede atribuirse un evento global' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION app.validate_audit_actor() OWNER TO nexodocs_security;
CREATE TRIGGER trg_audit_actor BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION app.validate_audit_actor();

-- Se reemplaza la política permisiva anterior: contexto y tenant son siempre AND
-- con los permisos. Ninguna futura política OR puede quitar este aislamiento.
DO $$
DECLARE r record; scope_column text; action_name text; command_name text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('tenant_departments','configuration'), ('users','user'), ('roles','role'),
    ('role_permissions','role'), ('user_roles','role'), ('user_groups','user'),
    ('user_group_members','user'), ('retention_policies','configuration'),
    ('document_categories','configuration'), ('document_types','configuration'),
    ('metadata_definitions','configuration'), ('expedient_types','configuration'),
    ('expedients','expedient'), ('expedient_participants','expedient'),
    ('documents','document'), ('document_versions','document_version'),
    ('document_metadata_values','document'), ('tags','configuration'),
    ('document_tags','document'), ('document_comments','document'),
    ('workflow_templates','workflow'), ('workflow_template_stages','workflow'),
    ('workflow_template_transitions','workflow'), ('workflows','workflow'),
    ('workflow_documents','workflow'), ('workflow_tasks','task'),
    ('workflow_events','workflow'), ('workflow_comments','workflow'),
    ('ocr_jobs','ocr'), ('notifications','notification'), ('audit_events','audit'),
    ('report_templates','report'), ('tenant_usage_monthly','report'), ('backup_history','configuration'),
    ('patients','patient'), ('clinical_staff','patient'), ('clinical_histories','patient'),
    ('clinical_episodes','patient'), ('clinical_document_links','patient'),
    ('dicom_studies','dicom'), ('dicom_series','dicom'), ('dicom_instances','dicom'),
    ('task_delegations','task'), ('user_push_tokens','notification'), ('tenants','tenant')
  ) AS table_permissions(table_name, module_name) LOOP
    scope_column := CASE WHEN r.table_name = 'tenants' THEN 'id' ELSE 'tenant_id' END;
    EXECUTE format('DROP POLICY tenant_isolation ON public.%I', r.table_name);
    EXECUTE format('CREATE POLICY tenant_context ON public.%I AS RESTRICTIVE TO nexodocs_app USING (%I = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid())) WITH CHECK (%I = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))', r.table_name, scope_column, scope_column);
    FOREACH command_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      action_name := CASE command_name WHEN 'SELECT' THEN 'read' WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
      IF r.table_name = 'task_delegations' AND command_name <> 'SELECT' THEN action_name := 'delegate'; END IF;
      IF command_name = 'INSERT' THEN
        EXECUTE format('CREATE POLICY rbac_insert ON public.%I FOR INSERT TO nexodocs_app WITH CHECK ((SELECT app.has_permission(%L)))', r.table_name, r.module_name || ':' || action_name);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO nexodocs_app USING ((SELECT app.has_permission(%L)))', 'rbac_' || lower(command_name), r.table_name, command_name, r.module_name || ':' || action_name);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Toda persona autenticada ve la ficha básica de su organización.
ALTER POLICY rbac_select ON tenants USING (true);
ALTER POLICY rbac_update ON tenants USING ((SELECT app.has_permission('configuration:update')));
REVOKE INSERT, UPDATE, DELETE ON tenants FROM nexodocs_app;
GRANT UPDATE (name, email, phone, address, logo_url, primary_color, settings) ON tenants TO nexodocs_app;
REVOKE INSERT, UPDATE, DELETE ON tenant_usage_monthly, backup_history FROM nexodocs_app;
REVOKE UPDATE, DELETE ON document_versions, audit_events, workflow_events FROM nexodocs_app, nexodocs_platform_admin;
REVOKE DELETE ON tenants, users, documents, expedients, patients, clinical_histories, clinical_episodes, workflows, dicom_studies, dicom_series, dicom_instances FROM nexodocs_app;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM nexodocs_app, nexodocs_platform_admin;

-- Evita promoverse a administrador de plataforma y exponer hashes en listados.
REVOKE SELECT, INSERT, UPDATE ON users FROM nexodocs_app;
DO $$
DECLARE safe_select text; safe_insert text; safe_update text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) FILTER (WHERE column_name <> 'password_hash'),
    string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) FILTER (WHERE column_name <> 'is_platform_admin'),
    string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) FILTER (WHERE column_name NOT IN ('id','tenant_id','is_platform_admin','created_at'))
  INTO safe_select, safe_insert, safe_update FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users';
  EXECUTE format('GRANT SELECT (%s) ON users TO nexodocs_app', safe_select);
  EXECUTE format('GRANT INSERT (%s) ON users TO nexodocs_app', safe_insert);
  EXECUTE format('GRANT UPDATE (%s) ON users TO nexodocs_app', safe_update);
END;
$$;

CREATE POLICY notification_recipient ON notifications AS RESTRICTIVE FOR SELECT TO nexodocs_app USING (user_id = (SELECT app.current_user_id()));
CREATE POLICY notification_update_recipient ON notifications AS RESTRICTIVE FOR UPDATE TO nexodocs_app USING (user_id = (SELECT app.current_user_id())) WITH CHECK (user_id = (SELECT app.current_user_id()));
CREATE POLICY notification_delete_recipient ON notifications AS RESTRICTIVE FOR DELETE TO nexodocs_app USING (user_id = (SELECT app.current_user_id()));
REVOKE UPDATE ON notifications FROM nexodocs_app;
GRANT UPDATE (is_read, read_at, archived_at) ON notifications TO nexodocs_app;
CREATE POLICY push_token_owner ON user_push_tokens AS RESTRICTIVE TO nexodocs_app USING (user_id = (SELECT app.current_user_id())) WITH CHECK (user_id = (SELECT app.current_user_id()));
CREATE POLICY report_reader ON report_templates AS RESTRICTIVE FOR SELECT TO nexodocs_app USING (owner_id = (SELECT app.current_user_id()) OR is_shared);
CREATE POLICY report_creator ON report_templates AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK (owner_id = (SELECT app.current_user_id()));
CREATE POLICY report_editor ON report_templates AS RESTRICTIVE FOR UPDATE TO nexodocs_app USING (owner_id = (SELECT app.current_user_id())) WITH CHECK (owner_id = (SELECT app.current_user_id()));
CREATE POLICY report_remover ON report_templates AS RESTRICTIVE FOR DELETE TO nexodocs_app USING (owner_id = (SELECT app.current_user_id()));
-- Los registros de lecturas/descargas los inserta el backend, con su actor real.
ALTER POLICY rbac_insert ON audit_events WITH CHECK (user_id = (SELECT app.current_user_id()));
CREATE POLICY workflow_event_actor ON workflow_events AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK (performed_by = (SELECT app.current_user_id()));
CREATE POLICY version_author ON document_versions AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK (author_id = (SELECT app.current_user_id()));
CREATE POLICY document_author ON documents AS RESTRICTIVE FOR INSERT TO nexodocs_app WITH CHECK (author_id = (SELECT app.current_user_id()));

CREATE FUNCTION app.check_document_status_permission() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE required_permission text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.author_id <> OLD.author_id THEN
    RAISE EXCEPTION 'El autor original del documento es inmutable' USING ERRCODE = '23514';
  END IF;
  IF NOT pg_has_role(current_user, 'nexodocs_app', 'USAGE') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT app.has_permission('document:delete') THEN
    RAISE EXCEPTION 'Permiso requerido: document:delete' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  required_permission := CASE NEW.status
    WHEN 'APPROVED' THEN 'document:approve' WHEN 'CURRENT' THEN 'document:approve'
    WHEN 'REJECTED' THEN 'document:reject' WHEN 'ARCHIVED' THEN 'document:archive'
    WHEN 'VOIDED' THEN 'document:delete' WHEN 'TRASHED' THEN 'document:delete' ELSE NULL END;
  IF required_permission IS NOT NULL AND NOT app.has_permission(required_permission) THEN
    RAISE EXCEPTION 'Permiso requerido: %', required_permission USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_document_status_permission BEFORE INSERT OR UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION app.check_document_status_permission();

-- Auditoría transaccional sin copiar contraseñas, tokens, contenido o metadatos.
CREATE FUNCTION app.audit_row_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE row_data jsonb; verb text; actor uuid; platform_actor uuid; scope_id uuid; changed_fields jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN RETURN NEW; END IF;
  actor := app.current_user_id();
  scope_id := CASE WHEN TG_TABLE_NAME = 'tenants' THEN (row_data->>'id')::uuid ELSE (row_data->>'tenant_id')::uuid END;
  IF actor IS NOT NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = actor AND tenant_id IS NULL AND is_platform_admin) THEN
    platform_actor := actor; actor := NULL;
  END IF;
  IF actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor AND tenant_id IS NOT DISTINCT FROM scope_id) THEN
    RAISE EXCEPTION 'Actor de auditoría ajeno al tenant' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_agg(n.key ORDER BY n.key) INTO changed_fields FROM jsonb_each(to_jsonb(NEW)) n
    WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM (to_jsonb(OLD)->n.key);
  END IF;
  verb := upper(TG_TABLE_NAME) || '_' || TG_OP;
  INSERT INTO public.audit_events(tenant_id, user_id, platform_actor_id, action, entity_type, entity_id, details)
  VALUES (scope_id, actor, platform_actor, verb, TG_TABLE_NAME,
    CASE WHEN row_data->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN (row_data->>'id')::uuid ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'record_id', row_data->'id', 'changed_fields', changed_fields,
      'document_id', row_data->'document_id', 'role_id', row_data->'role_id', 'user_id', row_data->'user_id',
      'permission_id', row_data->'permission_id'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION app.audit_row_change() OWNER TO nexodocs_security;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','documents','document_versions','expedients','users','roles','user_roles','role_permissions','workflows','workflow_tasks',
    'tenant_departments','user_groups','user_group_members','document_types','metadata_definitions','retention_policies',
    'workflow_templates','workflow_template_stages','workflow_template_transitions','task_delegations',
    'patients','clinical_histories','clinical_episodes','clinical_document_links'] LOOP
    EXECUTE format('CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.audit_row_change()', t);
  END LOOP;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
-- Funciones invoker utilizadas por triggers consultan las tablas con RLS del actor.
GRANT EXECUTE ON FUNCTION app.current_tenant_id(), app.current_user_id(), app.context_is_valid(), app.has_permission(text) TO nexodocs_app, nexodocs_security, nexodocs_platform_admin;

INSERT INTO app.schema_migrations(version) VALUES ('004_saas_hardening');
\endif
COMMIT;
