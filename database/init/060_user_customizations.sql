\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 60);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '060_user_customizations') AS already_applied \gset
\if :already_applied
  \echo '060_user_customizations ya aplicada'
\else
  -- Personalización de usuarios del tenant (permiso user:customize). Una fila por usuario;
  -- sin fila no hay restricciones ni preferencias definidas por el administrador.
  -- El horario se evalúa en la zona horaria del tenant (tenants.timezone).
  CREATE TABLE IF NOT EXISTS user_customizations (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    job_title varchar(120),
    language varchar(5),
    landing_page varchar(40),
    access_expires_on date,
    access_weekdays varchar(13),
    access_start_time time,
    access_end_time time,
    max_upload_mb integer,
    storage_quota_mb integer,
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_user_customizations PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT fk_user_customizations_user FOREIGN KEY (tenant_id, user_id)
      REFERENCES users(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_user_customizations_language CHECK (language IS NULL OR language IN ('es', 'en', 'fr', 'zh')),
    CONSTRAINT ck_user_customizations_landing CHECK (landing_page IS NULL OR landing_page ~ '^/[a-z0-9/_-]*$'),
    CONSTRAINT ck_user_customizations_weekdays CHECK (access_weekdays IS NULL OR access_weekdays ~ '^[1-7](,[1-7]){0,6}$'),
    CONSTRAINT ck_user_customizations_hours CHECK (
      (access_start_time IS NULL AND access_end_time IS NULL)
      OR (access_start_time IS NOT NULL AND access_end_time IS NOT NULL AND access_start_time <> access_end_time)),
    CONSTRAINT ck_user_customizations_upload CHECK (max_upload_mb IS NULL OR max_upload_mb BETWEEN 1 AND 25),
    CONSTRAINT ck_user_customizations_quota CHECK (storage_quota_mb IS NULL OR storage_quota_mb BETWEEN 1 AND 10000000)
  );

  -- Tipos documentales que el usuario puede usar al crear documentos. Sin filas, todos.
  CREATE TABLE IF NOT EXISTS user_allowed_document_types (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    document_type_id uuid NOT NULL,
    CONSTRAINT pk_user_allowed_document_types PRIMARY KEY (tenant_id, user_id, document_type_id),
    CONSTRAINT fk_user_allowed_document_types_user FOREIGN KEY (tenant_id, user_id)
      REFERENCES users(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_user_allowed_document_types_type FOREIGN KEY (tenant_id, document_type_id)
      REFERENCES document_types(tenant_id, id) ON DELETE CASCADE
  );

  -- Mismo patrón que 042: contexto restrictivo y RBAC permisivo. Cada usuario lee su propia
  -- configuración (la necesita /auth/me y la validación de subidas); el resto exige el permiso.
  DO $$
  DECLARE t text;
  BEGIN
    FOREACH t IN ARRAY ARRAY['user_customizations', 'user_allowed_document_types'] LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_context ON public.%I', t);
      EXECUTE format('CREATE POLICY tenant_context ON public.%I AS RESTRICTIVE TO nexodocs_app USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid())) WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))', t);
      EXECUTE format('DROP POLICY IF EXISTS rbac_select ON public.%I', t);
      EXECUTE format('CREATE POLICY rbac_select ON public.%I FOR SELECT TO nexodocs_app USING (user_id = (SELECT app.current_user_id()) OR (SELECT app.has_permission(''user:customize'')))', t);
      EXECUTE format('DROP POLICY IF EXISTS rbac_insert ON public.%I', t);
      EXECUTE format('CREATE POLICY rbac_insert ON public.%I FOR INSERT TO nexodocs_app WITH CHECK ((SELECT app.has_permission(''user:customize'')))', t);
      EXECUTE format('DROP POLICY IF EXISTS rbac_update ON public.%I', t);
      EXECUTE format('CREATE POLICY rbac_update ON public.%I FOR UPDATE TO nexodocs_app USING ((SELECT app.has_permission(''user:customize'')))', t);
      EXECUTE format('DROP POLICY IF EXISTS rbac_delete ON public.%I', t);
      EXECUTE format('CREATE POLICY rbac_delete ON public.%I FOR DELETE TO nexodocs_app USING ((SELECT app.has_permission(''user:customize'')))', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO nexodocs_app', t);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_change ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.audit_row_change()', t);
      -- Las tablas nuevas también quedan bloqueadas durante una restauración (050).
      IF to_regprocedure('app.backup_lock_writes()') IS NOT NULL THEN
        EXECUTE format('DROP TRIGGER IF EXISTS backup_write_lock ON public.%I', t);
        EXECUTE format('CREATE TRIGGER backup_write_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.backup_lock_writes()', t);
      END IF;
    END LOOP;
  END $$;

  -- Bytes subidos por un usuario (versiones de documentos de las que es autor). document_versions
  -- exige document_version:read; esta función solo responde por el propio usuario o con user:customize.
  CREATE OR REPLACE FUNCTION app.user_storage_bytes(target uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
    SELECT COALESCE(SUM(v.file_size_bytes), 0)::bigint
    FROM public.document_versions v
    WHERE app.context_is_valid()
      AND (target = app.current_user_id() OR app.has_permission('user:customize'))
      AND v.tenant_id = app.current_tenant_id()
      AND v.author_id = target
  $$;
  ALTER FUNCTION app.user_storage_bytes(uuid) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.user_storage_bytes(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.user_storage_bytes(uuid) TO nexodocs_app;

  -- Quien personaliza puede actualizar otros usuarios sin user:update, pero solo en las columnas
  -- de perfil y preferencias. users_guard_self_update (058) sigue protegiendo estado, departamento,
  -- usuario y baja; esta guarda limita además el resto de columnas.
  DROP POLICY IF EXISTS customize_update ON public.users;
  CREATE POLICY customize_update ON public.users FOR UPDATE TO nexodocs_app
    USING ((SELECT app.has_permission('user:customize')))
    WITH CHECK ((SELECT app.has_permission('user:customize')));

  CREATE OR REPLACE FUNCTION app.guard_users_customize_update() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public, app, pg_temp AS $$
  DECLARE
    allowed text[] := ARRAY['phone', 'biography', 'email_notifications', 'push_notifications',
                            'must_change_password', 'preferred_language', 'updated_at'];
  BEGIN
    IF current_user = 'nexodocs_app'
       AND NEW.id IS DISTINCT FROM app.current_user_id()
       AND NOT app.has_permission('user:update')
       AND (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
      RAISE EXCEPTION 'Changing account data of another user requires user:update'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS users_guard_customize_update ON public.users;
  CREATE TRIGGER users_guard_customize_update BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION app.guard_users_customize_update();

  INSERT INTO permissions (code, module, action, description, criticality)
  VALUES ('user:customize', 'user', 'customize',
          'Personalizar usuarios: perfil, preferencias, notificaciones, horario y vigencia de acceso y límites documentales',
          'HIGH')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r
  JOIN permissions p ON p.code = 'user:customize'
  WHERE lower(r.name) IN ('administrador de tenant', 'tenant_admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('060_user_customizations');
  \echo '060_user_customizations aplicada exitosamente'
\endif

COMMIT;
