\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 66);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '066_platform_roles') AS already_applied \gset
\if :already_applied
  \echo '066_platform_roles ya aplicada'
\else
  -- Fase 5 del plan de administración: roles internos de plataforma, doble factor para sus cuentas y
  -- acceso de soporte con consentimiento del tenant. Las tablas de plataforma no dan privilegios a
  -- nexodocs_app; las escribe el backend con su usuario de conexión.

  -- ------------------------------------------------------------ roles internos
  CREATE TABLE IF NOT EXISTS public.platform_roles (
    code varchar(20) PRIMARY KEY CHECK (code IN ('SUPERADMIN', 'FINANCE', 'SUPPORT', 'OPERATIONS')),
    name varchar(60) NOT NULL,
    description varchar(300) NOT NULL,
    sort_order integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS public.platform_role_authorities (
    role_code varchar(20) NOT NULL REFERENCES public.platform_roles(code),
    authority varchar(60) NOT NULL CHECK (authority ~ '^[a-z_]+(:[a-z_]+)+$'),
    PRIMARY KEY (role_code, authority)
  );
  -- Un rol por cuenta de plataforma.
  CREATE TABLE IF NOT EXISTS public.platform_user_roles (
    user_id uuid PRIMARY KEY REFERENCES users(id),
    role_code varchar(20) NOT NULL REFERENCES public.platform_roles(code),
    assigned_by uuid REFERENCES users(id),
    assigned_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE OR REPLACE FUNCTION app.require_platform_account() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND tenant_id IS NULL AND is_platform_admin) THEN
      RAISE EXCEPTION 'Solo una cuenta de plataforma puede tener un rol interno' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END $$;
  DROP TRIGGER IF EXISTS trg_platform_user_roles_account ON public.platform_user_roles;
  CREATE TRIGGER trg_platform_user_roles_account BEFORE INSERT OR UPDATE ON public.platform_user_roles
    FOR EACH ROW EXECUTE FUNCTION app.require_platform_account();

  INSERT INTO public.platform_roles (code, name, description, sort_order) VALUES
    ('SUPERADMIN', 'Superadministrador', 'Todo, incluida la gestión del equipo de plataforma', 1),
    ('FINANCE', 'Finanzas', 'Precios, planes, complementos, descuentos y reportes de ingresos', 2),
    ('SUPPORT', 'Soporte', 'Fichas de organización, extender pruebas y solicitar acceso de soporte', 3),
    ('OPERATIONS', 'Operaciones', 'Respaldos, altas y suspensiones por incidente técnico', 4)
  ON CONFLICT (code) DO NOTHING;

  -- platform:tenant:manage es la autoridad base de toda cuenta de plataforma (panel, fichas, reportes y
  -- auditoría de plataforma); las demás habilitan acciones concretas.
  INSERT INTO public.platform_role_authorities (role_code, authority)
  SELECT r.code, a.authority FROM public.platform_roles r
  JOIN (VALUES
    ('SUPERADMIN', 'platform:tenant:manage'), ('SUPERADMIN', 'audit:read_global'), ('SUPERADMIN', 'platform:tenant:lifecycle'),
    ('SUPERADMIN', 'platform:tenant:trial'), ('SUPERADMIN', 'platform:billing:manage'), ('SUPERADMIN', 'platform:discount:apply'),
    ('SUPERADMIN', 'platform:discount:approve'), ('SUPERADMIN', 'platform:backup:manage'), ('SUPERADMIN', 'platform:support:access'),
    ('SUPERADMIN', 'platform:team:manage'),
    ('FINANCE', 'platform:tenant:manage'), ('FINANCE', 'platform:billing:manage'), ('FINANCE', 'platform:discount:apply'),
    ('FINANCE', 'platform:discount:approve'),
    ('SUPPORT', 'platform:tenant:manage'), ('SUPPORT', 'platform:tenant:trial'), ('SUPPORT', 'platform:support:access'),
    ('SUPPORT', 'platform:discount:apply'),
    ('OPERATIONS', 'platform:tenant:manage'), ('OPERATIONS', 'platform:tenant:lifecycle'), ('OPERATIONS', 'platform:backup:manage')
  ) AS a(role_code, authority) ON a.role_code = r.code
  ON CONFLICT DO NOTHING;

  -- Las cuentas de plataforma existentes conservan todo lo que podían hacer.
  INSERT INTO public.platform_user_roles (user_id, role_code)
  SELECT id, 'SUPERADMIN' FROM public.users WHERE tenant_id IS NULL AND is_platform_admin AND deleted_at IS NULL
  ON CONFLICT (user_id) DO NOTHING;

  -- ------------------------------------------------------------ doble factor
  -- Secreto TOTP cifrado por el backend (AES-GCM); enabled_at nulo = alta pendiente de confirmar.
  -- last_used_step impide reutilizar un código; failed_attempts y locked_until frenan la fuerza bruta.
  CREATE TABLE IF NOT EXISTS public.platform_user_mfa (
    user_id uuid PRIMARY KEY REFERENCES users(id),
    secret_enc text NOT NULL,
    enabled_at timestamptz,
    last_used_step bigint,
    failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  DROP TRIGGER IF EXISTS trg_platform_user_mfa_account ON public.platform_user_mfa;
  CREATE TRIGGER trg_platform_user_mfa_account BEFORE INSERT OR UPDATE ON public.platform_user_mfa
    FOR EACH ROW EXECUTE FUNCTION app.require_platform_account();

  REVOKE ALL ON public.platform_roles, public.platform_role_authorities, public.platform_user_roles, public.platform_user_mfa FROM PUBLIC;
  REVOKE ALL ON public.platform_roles, public.platform_role_authorities, public.platform_user_roles, public.platform_user_mfa FROM nexodocs_app;

  -- ---------------------------------------------------- acceso de soporte
  -- Solo permisos de lectura: nombre de módulo seguido de :read (o audit:read_tenant).
  CREATE OR REPLACE FUNCTION app.support_codes_are_read_only(codes text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
    SELECT cardinality(codes) >= 1 AND coalesce(bool_and(c ~ '^[a-z_]+:read$' OR c = 'audit:read_tenant'), false)
    FROM unnest(codes) AS c
  $$;

  CREATE TABLE IF NOT EXISTS public.support_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    requested_by uuid NOT NULL REFERENCES users(id),
    reason varchar(1000) NOT NULL CHECK (char_length(btrim(reason)) >= 5),
    modules text[] NOT NULL CHECK (cardinality(modules) >= 1),
    permission_codes text[] NOT NULL CHECK (app.support_codes_are_read_only(permission_codes)),
    duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
    break_glass boolean NOT NULL DEFAULT false,
    status varchar(16) NOT NULL CHECK (status IN ('PENDING_TENANT', 'PENDING_INTERNAL', 'APPROVED', 'REJECTED', 'REVOKED', 'CANCELED')),
    decided_by uuid REFERENCES users(id),
    decided_at timestamptz,
    decision_note varchar(500),
    starts_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    revoked_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_support_access_tenant_id UNIQUE (tenant_id, id),
    -- Un acceso normal espera al tenant; uno de emergencia, a las aprobaciones internas.
    CONSTRAINT ck_support_access_pending CHECK (
      (status <> 'PENDING_INTERNAL' OR break_glass) AND (status <> 'PENDING_TENANT' OR NOT break_glass)),
    -- Aprobada: ventana de como máximo duration_minutes. Sin aprobar nunca tiene ventana.
    CONSTRAINT ck_support_access_window CHECK (
      (status <> 'APPROVED' AND starts_at IS NULL AND expires_at IS NULL)
      OR (starts_at IS NOT NULL AND expires_at > starts_at AND expires_at <= starts_at + make_interval(mins => duration_minutes)))
  );
  CREATE INDEX IF NOT EXISTS idx_support_access_tenant ON public.support_access_requests (tenant_id, created_at DESC);

  -- Aprobaciones internas de un acceso de emergencia (break-glass).
  CREATE TABLE IF NOT EXISTS public.support_access_approvals (
    request_id uuid NOT NULL REFERENCES public.support_access_requests(id),
    approver_id uuid NOT NULL REFERENCES users(id),
    role_code varchar(20) NOT NULL REFERENCES public.platform_roles(code),
    note varchar(500),
    approved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (request_id, approver_id)
  );

  -- Quién solicita es siempre una cuenta de plataforma; quién aprueba un acceso normal, un usuario del
  -- propio tenant; un acceso de emergencia necesita dos aprobaciones internas de otras personas, una de
  -- un superadministrador y otra de un rol distinto. La base lo exige aunque el backend falle.
  CREATE OR REPLACE FUNCTION app.validate_support_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.requested_by AND tenant_id IS NULL AND is_platform_admin) THEN
        RAISE EXCEPTION 'El acceso de soporte lo solicita una cuenta de plataforma' USING ERRCODE = '23514';
      END IF;
      IF NEW.status NOT IN ('PENDING_TENANT', 'PENDING_INTERNAL') THEN
        RAISE EXCEPTION 'Una solicitud nueva empieza pendiente' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    IF OLD.status IN ('REJECTED', 'REVOKED', 'CANCELED') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'La solicitud ya está cerrada' USING ERRCODE = '23514';
    END IF;
    IF NEW.tenant_id <> OLD.tenant_id OR NEW.requested_by <> OLD.requested_by OR NEW.permission_codes <> OLD.permission_codes
       OR NEW.duration_minutes <> OLD.duration_minutes OR NEW.break_glass <> OLD.break_glass THEN
      RAISE EXCEPTION 'La solicitud no se puede modificar' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED' THEN
      IF NEW.break_glass THEN
        IF NOT (
          (SELECT count(DISTINCT approver_id) FROM public.support_access_approvals
            WHERE request_id = NEW.id AND approver_id <> NEW.requested_by) >= 2
          AND EXISTS (SELECT 1 FROM public.support_access_approvals
            WHERE request_id = NEW.id AND approver_id <> NEW.requested_by AND role_code = 'SUPERADMIN')
          AND EXISTS (SELECT 1 FROM public.support_access_approvals
            WHERE request_id = NEW.id AND approver_id <> NEW.requested_by AND role_code <> 'SUPERADMIN')
        ) THEN
          RAISE EXCEPTION 'El acceso de emergencia necesita la aprobación de un superadministrador y de otro rol' USING ERRCODE = '23514';
        END IF;
      ELSIF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.decided_by AND tenant_id = NEW.tenant_id AND NOT is_platform_admin) THEN
        RAISE EXCEPTION 'Solo la organización aprueba un acceso de soporte' USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END $$;
  DROP TRIGGER IF EXISTS trg_support_access_validate ON public.support_access_requests;
  CREATE TRIGGER trg_support_access_validate BEFORE INSERT OR UPDATE ON public.support_access_requests
    FOR EACH ROW EXECUTE FUNCTION app.validate_support_access();
  CREATE OR REPLACE FUNCTION app.validate_support_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.platform_user_roles WHERE user_id = NEW.approver_id AND role_code = NEW.role_code) THEN
      RAISE EXCEPTION 'El rol de la aprobación no corresponde a la cuenta' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END $$;
  DROP TRIGGER IF EXISTS trg_support_approval_validate ON public.support_access_approvals;
  CREATE TRIGGER trg_support_approval_validate BEFORE INSERT ON public.support_access_approvals
    FOR EACH ROW EXECUTE FUNCTION app.validate_support_approval();

  -- El tenant ve sus solicitudes; las decide con app.decide_support_access, nunca con DML directo.
  ALTER TABLE public.support_access_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.support_access_requests FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_context ON public.support_access_requests;
  CREATE POLICY tenant_context ON public.support_access_requests AS RESTRICTIVE TO nexodocs_app
    USING (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()))
    WITH CHECK (tenant_id = (SELECT app.current_tenant_id()) AND (SELECT app.context_is_valid()));
  DROP POLICY IF EXISTS support_access_read ON public.support_access_requests;
  CREATE POLICY support_access_read ON public.support_access_requests FOR SELECT TO nexodocs_app USING (true);
  REVOKE ALL ON public.support_access_requests, public.support_access_approvals FROM PUBLIC;
  REVOKE ALL ON public.support_access_requests, public.support_access_approvals FROM nexodocs_app;
  GRANT SELECT ON public.support_access_requests TO nexodocs_app;

  -- Prueba de la sesión de soporte: la transacción es de solo lectura (una vez que corre una consulta ya
  -- no puede volver a escritura), app.support_access_id apunta a una solicitud aprobada y vigente de ese
  -- tenant, pedida por la cuenta de plataforma del contexto, que sigue activa. Su dueño (el de la
  -- migración) se salta RLS para leer la solicitud.
  -- plpgsql y no sql: en SQL el AND no garantiza el orden y el cast de un valor vacío fallaría en cada
  -- petición normal, que no lleva app.support_access_id.
  CREATE OR REPLACE FUNCTION app.support_session_valid() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  DECLARE
    v_id text := coalesce(current_setting('app.support_access_id', true), '');
  BEGIN
    IF v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR current_setting('transaction_read_only') <> 'on' THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.support_access_requests s
      JOIN public.users u ON u.id = s.requested_by
      JOIN public.tenants t ON t.id = s.tenant_id
      WHERE s.id = v_id::uuid
        AND s.tenant_id = app.current_tenant_id() AND s.requested_by = app.current_user_id()
        AND s.status = 'APPROVED' AND s.starts_at <= now() AND s.expires_at > now() AND s.revoked_at IS NULL
        AND u.tenant_id IS NULL AND u.is_platform_admin AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
        AND t.subscription_status IN ('TRIAL', 'ACTIVE', 'PAST_DUE') AND t.purged_at IS NULL);
  END $$;
  CREATE OR REPLACE FUNCTION app.support_session_allows(permission_code text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  BEGIN
    IF NOT app.support_session_valid() OR NOT app.support_codes_are_read_only(ARRAY[permission_code]) THEN
      RETURN false;
    END IF;
    RETURN EXISTS (SELECT 1 FROM public.support_access_requests s
      WHERE s.id = current_setting('app.support_access_id', true)::uuid AND permission_code = ANY (s.permission_codes));
  END $$;
  REVOKE ALL ON FUNCTION app.support_session_valid(), app.support_session_allows(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.support_session_valid(), app.support_session_allows(text) TO nexodocs_app, nexodocs_security;

  -- context_is_valid (004) sigue excluyendo a las cuentas de plataforma salvo con una sesión de soporte válida.
  CREATE OR REPLACE FUNCTION app.context_is_valid() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
      WHERE u.id = app.current_user_id() AND u.tenant_id = app.current_tenant_id()
        AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND NOT u.is_platform_admin
        AND t.subscription_status IN ('TRIAL','ACTIVE','PAST_DUE')
    ) OR app.support_session_valid()
  $$;

  -- has_permission (048) con el mismo cuerpo; en una sesión de soporte solo valen los permisos de lectura
  -- aprobados por el tenant.
  CREATE OR REPLACE FUNCTION app.has_permission(permission_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
    SELECT CASE WHEN app.support_session_valid() THEN app.support_session_allows(permission_code) ELSE (
    SELECT app.context_is_valid() AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active
      JOIN public.role_permissions rp ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active
      JOIN public.tenants t ON t.id = ur.tenant_id
      WHERE ur.tenant_id = app.current_tenant_id() AND ur.user_id = app.current_user_id() AND p.code = permission_code
        AND (
          (p.module IN ('workflow', 'workflow_template') AND EXISTS (
            SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'workflows' AND pf.is_enabled = true
          ))
          OR
          (p.module = 'ocr' AND EXISTS (
            SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'ocr_scanning' AND pf.is_enabled = true
          ))
          OR
          (p.module IN ('patient', 'medical_note', 'clinical', 'clinical_history', 'clinical_staff') AND EXISTS (
            SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'clinical_module' AND pf.is_enabled = true
          ))
          OR
          (p.module = 'dicom' AND EXISTS (
            SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'dicom_imaging' AND pf.is_enabled = true
          ))
          OR
          (p.module = 'report' AND EXISTS (
            SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'advanced_analytics' AND pf.is_enabled = true
          ))
          OR
          (p.module NOT IN ('workflow', 'workflow_template', 'ocr', 'patient', 'medical_note', 'clinical', 'clinical_history', 'clinical_staff', 'dicom', 'report'))
        )
    )) END
  $$;

  -- Decisión del administrador del tenant (aprobar, rechazar o revocar). Exige un usuario normal del
  -- tenant (no una sesión de soporte) con tenant:update o tenant:manage, y deja el evento en su auditoría.
  CREATE OR REPLACE FUNCTION app.decide_support_access(p_request uuid, p_decision text, p_note text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  DECLARE
    req public.support_access_requests;
    next_status text;
  BEGIN
    IF NOT app.context_is_valid() OR app.support_session_valid()
       OR NOT (app.has_permission('tenant:update') OR app.has_permission('tenant:manage')) THEN
      RAISE EXCEPTION 'No tienes permiso para decidir accesos de soporte' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO req FROM public.support_access_requests
      WHERE id = p_request AND tenant_id = app.current_tenant_id() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = '02000'; END IF;
    IF p_decision = 'APPROVE' AND req.status = 'PENDING_TENANT' THEN
      UPDATE public.support_access_requests SET status = 'APPROVED', decided_by = app.current_user_id(), decided_at = now(),
        decision_note = left(p_note, 500), starts_at = now(), expires_at = now() + make_interval(mins => req.duration_minutes)
      WHERE id = req.id;
      next_status := 'APPROVED';
    ELSIF p_decision = 'REJECT' AND req.status = 'PENDING_TENANT' THEN
      UPDATE public.support_access_requests SET status = 'REJECTED', decided_by = app.current_user_id(), decided_at = now(),
        decision_note = left(p_note, 500) WHERE id = req.id;
      next_status := 'REJECTED';
    ELSIF p_decision = 'REVOKE' AND (req.status IN ('PENDING_TENANT', 'PENDING_INTERNAL')
          OR (req.status = 'APPROVED' AND req.expires_at > now())) THEN
      UPDATE public.support_access_requests SET status = 'REVOKED', revoked_at = now(), revoked_by = app.current_user_id(),
        decision_note = coalesce(left(p_note, 500), decision_note) WHERE id = req.id;
      next_status := 'REVOKED';
    ELSE
      RAISE EXCEPTION 'La solicitud no admite esa decisión en su estado actual' USING ERRCODE = '55000';
    END IF;
    INSERT INTO public.audit_events (tenant_id, user_id, action, entity_type, entity_id, result, details)
    VALUES (req.tenant_id, app.current_user_id(), 'SUPPORT_ACCESS_' || next_status, 'support_access_requests', req.id, 'SUCCESS',
            jsonb_build_object('note', left(p_note, 500), 'modules', req.modules, 'durationMinutes', req.duration_minutes));
    RETURN next_status;
  END $$;
  REVOKE ALL ON FUNCTION app.decide_support_access(uuid, text, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.decide_support_access(uuid, text, text) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('066_platform_roles');
  \echo '066_platform_roles aplicada exitosamente'
\endif

COMMIT;
