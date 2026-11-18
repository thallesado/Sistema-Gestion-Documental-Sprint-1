\set ON_ERROR_STOP on
-- Regresión de 066_platform_roles. La sesión de soporte depende del modo de solo lectura de la
-- transacción, así que cada comprobación corre en su propia transacción y la solicitud de prueba se
-- confirma al principio y se borra al final.

-- Un usuario de tenant con tenant:update, una cuenta de plataforma activa y otra organización.
SELECT u.tenant_id AS tenant, u.id AS tenant_user
FROM users u JOIN tenants t ON t.id = u.tenant_id
JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
JOIN role_permissions rp ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
JOIN permissions p ON p.id = rp.permission_id AND p.code = 'tenant:update'
WHERE u.status = 'ACTIVE' AND u.deleted_at IS NULL AND t.subscription_status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
LIMIT 1 \gset
SELECT id AS platform_user FROM users WHERE tenant_id IS NULL AND is_platform_admin AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1 \gset
SELECT coalesce((SELECT id::text FROM tenants WHERE id <> :'tenant' LIMIT 1), :'tenant') AS other_tenant \gset

-- Las cuentas de plataforma existentes tienen rol; nexodocs_app no ve roles ni secretos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users u WHERE u.tenant_id IS NULL AND u.is_platform_admin AND u.deleted_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM platform_user_roles r WHERE r.user_id = u.id)) THEN
    RAISE EXCEPTION 'A platform account has no internal role';
  END IF;
END $$;

-- Fixture: solicitud pendiente de documentos (solo lectura).
BEGIN;
INSERT INTO support_access_requests (tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, status)
VALUES (:'tenant', :'platform_user', 'Prueba de regresión 066', ARRAY['DOCUMENTS'], ARRAY['document:read', 'tenant:read'], 30, 'PENDING_TENANT')
RETURNING id AS req \gset
COMMIT;

-- 1. Pendiente: la cuenta de plataforma no ve nada del tenant.
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'platform_user', true),
       set_config('app.support_access_id', :'req', true) \gset dummy_
DO $$
BEGIN
  IF app.context_is_valid() THEN RAISE EXCEPTION 'Pending support access must not open the tenant context'; END IF;
  IF (SELECT count(*) FROM tenants) <> 0 THEN RAISE EXCEPTION 'A platform account read tenant data without approval'; END IF;
END $$;
ROLLBACK;

-- 2. Sin solicitud: tampoco.
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'platform_user', true) \gset dummy_
DO $$
BEGIN
  IF app.context_is_valid() OR (SELECT count(*) FROM tenants) <> 0 THEN
    RAISE EXCEPTION 'A platform account read tenant data without support access';
  END IF;
END $$;
ROLLBACK;

-- Aprobación del tenant (con el usuario de conexión, como si la hubiera hecho app.decide_support_access).
BEGIN;
UPDATE support_access_requests SET status = 'APPROVED', decided_by = :'tenant_user', decided_at = now(),
  starts_at = now(), expires_at = now() + interval '30 minutes' WHERE id = :'req';
COMMIT;

-- 3. Aprobada pero en una transacción de escritura: no vale.
BEGIN;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'platform_user', true),
       set_config('app.support_access_id', :'req', true) \gset dummy_
DO $$
BEGIN
  IF app.context_is_valid() THEN RAISE EXCEPTION 'A support session must be read-only'; END IF;
END $$;
ROLLBACK;

-- 4. Aprobada y de solo lectura: lee lo aprobado y nada más.
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'platform_user', true),
       set_config('app.support_access_id', :'req', true) \gset dummy_
DO $$
BEGIN
  IF NOT app.context_is_valid() THEN RAISE EXCEPTION 'An approved support session was not recognized'; END IF;
  IF (SELECT count(*) FROM tenants) <> 1 THEN RAISE EXCEPTION 'The support session cannot read its tenant'; END IF;
  IF NOT app.has_permission('document:read') THEN RAISE EXCEPTION 'Approved read permission was not granted'; END IF;
  IF app.has_permission('document:create') OR app.has_permission('patient:read') THEN
    RAISE EXCEPTION 'The support session got a permission the tenant did not approve';
  END IF;
END $$;
ROLLBACK;

-- 5. Otra cuenta, otro tenant o un identificador falso: no vale.
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', gen_random_uuid()::text, true),
       set_config('app.support_access_id', :'req', true) \gset dummy_
DO $$ BEGIN IF app.context_is_valid() THEN RAISE EXCEPTION 'Support access worked for another account'; END IF; END $$;
ROLLBACK;
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'other_tenant', true), set_config('app.user_id', :'platform_user', true),
       set_config('app.support_access_id', :'req', true) \gset dummy_
SELECT app.context_is_valid() AND :'other_tenant' <> :'tenant' AS leaked \gset
\if :leaked
  \echo 'Support access worked for another tenant'
  SELECT 1/0;
\endif
ROLLBACK;
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'platform_user', true),
       set_config('app.support_access_id', 'no-es-un-uuid', true) \gset dummy_
DO $$ BEGIN IF app.context_is_valid() THEN RAISE EXCEPTION 'An invalid support id was accepted'; END IF; END $$;
ROLLBACK;

-- 6. nexodocs_app no modifica solicitudes ni lee los secretos de MFA.
BEGIN;
SET LOCAL ROLE nexodocs_app;
DO $$
BEGIN
  BEGIN
    UPDATE support_access_requests SET duration_minutes = 240;
    RAISE EXCEPTION 'nexodocs_app must not update support_access_requests';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM platform_user_mfa LIMIT 1;
    RAISE EXCEPTION 'nexodocs_app must not read platform_user_mfa';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM platform_user_roles LIMIT 1;
    RAISE EXCEPTION 'nexodocs_app must not read platform_user_roles';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

-- 7. Reglas de la solicitud: solo lectura, emergencia con doble aprobación y aprobación del propio tenant.
BEGIN;
SELECT set_config('test.tenant', :'tenant', true), set_config('test.platform', :'platform_user', true) \gset dummy_
DO $$
DECLARE v_tenant uuid := current_setting('test.tenant')::uuid; v_platform uuid := current_setting('test.platform')::uuid; v_id uuid;
BEGIN
  BEGIN
    INSERT INTO support_access_requests (tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, status)
    VALUES (v_tenant, v_platform, 'Prueba de regresión', ARRAY['DOCUMENTS'], ARRAY['document:create'], 30, 'PENDING_TENANT');
    RAISE EXCEPTION 'A write permission must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO support_access_requests (tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, status)
    VALUES (v_tenant, v_platform, 'Prueba de regresión', ARRAY['DOCUMENTS'], ARRAY['document:read'], 600, 'PENDING_TENANT');
    RAISE EXCEPTION 'A support access longer than 4 hours must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO support_access_requests (tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, status, break_glass)
  VALUES (v_tenant, v_platform, 'Emergencia de prueba', ARRAY['DOCUMENTS'], ARRAY['document:read'], 30, 'PENDING_INTERNAL', true)
  RETURNING id INTO v_id;
  BEGIN
    UPDATE support_access_requests SET status = 'APPROVED', starts_at = now(), expires_at = now() + interval '30 minutes' WHERE id = v_id;
    RAISE EXCEPTION 'Break-glass access without internal approvals must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO support_access_requests (tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, status)
  VALUES (v_tenant, v_platform, 'Prueba de regresión', ARRAY['DOCUMENTS'], ARRAY['document:read'], 30, 'PENDING_TENANT')
  RETURNING id INTO v_id;
  BEGIN
    UPDATE support_access_requests SET status = 'APPROVED', decided_by = v_platform, starts_at = now(),
      expires_at = now() + interval '30 minutes' WHERE id = v_id;
    RAISE EXCEPTION 'Only the tenant may approve a support access';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;

-- 8. El administrador del tenant decide con app.decide_support_access y queda en su auditoría.
BEGIN;
INSERT INTO support_access_requests (tenant_id, requested_by, reason, modules, permission_codes, duration_minutes, status)
VALUES (:'tenant', :'platform_user', 'Prueba de decisión', ARRAY['DOCUMENTS'], ARRAY['document:read'], 30, 'PENDING_TENANT')
RETURNING id AS req2 \gset
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'tenant_user', true) \gset dummy_
SELECT app.decide_support_access(:'req2', 'APPROVE', 'Autorizado para la prueba') = 'APPROVED' AS approved \gset
\if :approved
\else
  SELECT 1/0;
\endif
RESET ROLE;
SELECT count(*) = 1 AS audited FROM audit_events WHERE entity_id = :'req2' AND action = 'SUPPORT_ACCESS_APPROVED' \gset
\if :audited
\else
  \echo 'The tenant decision was not audited'
  SELECT 1/0;
\endif
ROLLBACK;

-- 9. Vencida: deja de valer.
BEGIN;
UPDATE support_access_requests SET starts_at = now() - interval '20 minutes', expires_at = now() - interval '1 minute' WHERE id = :'req';
COMMIT;
BEGIN READ ONLY;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', :'tenant', true), set_config('app.user_id', :'platform_user', true),
       set_config('app.support_access_id', :'req', true) \gset dummy_
DO $$ BEGIN IF app.context_is_valid() THEN RAISE EXCEPTION 'An expired support access still works'; END IF; END $$;
ROLLBACK;

DELETE FROM support_access_requests WHERE id = :'req';
\echo 'platform-roles.sql OK'
