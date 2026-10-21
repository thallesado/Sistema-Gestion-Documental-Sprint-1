-- 048_enforce_plan_role_permissions.sql
-- Asegura la diferenciación estricta de permisos entre planes (Básico, Pro y Enterprise):
-- 1. Depura role_permissions de roles pertenecientes a tenants cuyas funcionalidades de plan estén desactivadas.
-- 2. Refuerza app.has_permission para comprobar que el permiso corresponda a una funcionalidad activa del plan del tenant.

BEGIN;

-- 1. Depurar permisos incompatibles con el plan del tenant en role_permissions
DELETE FROM role_permissions rp
USING tenants t, permissions p
WHERE rp.tenant_id = t.id
  AND rp.permission_id = p.id
  AND (
    (p.module IN ('workflow', 'workflow_template') AND NOT EXISTS (
      SELECT 1 FROM plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'workflows' AND pf.is_enabled = true
    ))
    OR
    (p.module = 'ocr' AND NOT EXISTS (
      SELECT 1 FROM plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'ocr_scanning' AND pf.is_enabled = true
    ))
    OR
    (p.module IN ('patient', 'medical_note', 'clinical', 'clinical_history', 'clinical_staff') AND NOT EXISTS (
      SELECT 1 FROM plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'clinical_module' AND pf.is_enabled = true
    ))
    OR
    (p.module = 'dicom' AND NOT EXISTS (
      SELECT 1 FROM plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'dicom_imaging' AND pf.is_enabled = true
    ))
    OR
    (p.module = 'report' AND NOT EXISTS (
      SELECT 1 FROM plan_features pf WHERE pf.plan_id = t.plan_id AND pf.feature_key = 'advanced_analytics' AND pf.is_enabled = true
    ))
  );

-- 2. Fortalecer app.has_permission a nivel de funciones RLS
CREATE OR REPLACE FUNCTION app.has_permission(permission_code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
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
  )
$$;

COMMIT;
