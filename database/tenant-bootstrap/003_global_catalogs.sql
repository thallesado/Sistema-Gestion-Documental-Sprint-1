BEGIN;

-- Catálogos globales requeridos por el backend. No cargar aquí tenants, usuarios,
-- roles demo, documentos, pacientes ni transacciones sandbox.
INSERT INTO plans (id, code, name, description, price_monthly, price_yearly, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', 'BASIC', 'Básico', 'Gestión documental esencial para organizaciones pequeñas.', 29, 290, 1),
('10000000-0000-0000-0000-000000000002', 'PRO', 'Profesional', 'Workflows, OCR, reportes y branding personalizado.', 79, 790, 2),
('10000000-0000-0000-0000-000000000003', 'ENTERPRISE', 'Empresarial', 'Capacidad ampliada, API y módulos especializados.', 199, 1990, 3);

INSERT INTO plan_limits (plan_id, resource_key, resource_value, unit)
SELECT p.id, limits.resource_key, limits.resource_value, limits.unit
FROM plans p
CROSS JOIN LATERAL (VALUES
  ('maxUsers', CASE p.code WHEN 'BASIC' THEN 10 WHEN 'PRO' THEN 100 ELSE -1 END, 'users'),
  ('maxStorageMB', CASE p.code WHEN 'BASIC' THEN 5120 WHEN 'PRO' THEN 25600 ELSE -1 END, 'MB'),
  ('maxDocuments', CASE p.code WHEN 'BASIC' THEN 500 WHEN 'PRO' THEN 5000 ELSE -1 END, 'documents'),
  ('maxOcrPagesPerMonth', CASE p.code WHEN 'BASIC' THEN 0 WHEN 'PRO' THEN 1000 ELSE -1 END, 'pages/month')
) AS limits(resource_key, resource_value, unit);

INSERT INTO plan_features (plan_id, feature_key, is_enabled, description)
SELECT p.id, features.feature_key,
  CASE
    WHEN p.code = 'ENTERPRISE' THEN true
    WHEN p.code = 'PRO' AND features.feature_key IN ('workflows', 'ocr_scanning', 'custom_branding', 'advanced_analytics') THEN true
    ELSE false
  END,
  features.description
FROM plans p
CROSS JOIN (VALUES
  ('workflows', false, 'Flujos documentales'),
  ('ocr_scanning', false, 'Digitalización con OCR'),
  ('custom_branding', false, 'Identidad visual por tenant'),
  ('advanced_analytics', false, 'Reportes avanzados'),
  ('clinical_module', false, 'Especialización clínica'),
  ('dicom_imaging', false, 'Imagenología DICOM')
) AS features(feature_key, basic_enabled, description);

INSERT INTO permissions (code, module, action, description)
SELECT module || ':' || action, module, action, initcap(action) || ' en ' || module
FROM unnest(ARRAY['tenant','user','role','permission','expedient','document','document_version','workflow','task','audit','report','notification','ocr','configuration','patient','dicom']) AS module
CROSS JOIN unnest(ARRAY['read','create','update','delete']) AS action;

INSERT INTO permissions (code, module, action, description) VALUES
('document:approve', 'document', 'approve', 'Aprobar documentos'),
('document:reject', 'document', 'reject', 'Rechazar documentos'),
('document:archive', 'document', 'archive', 'Archivar documentos'),
('document:download', 'document', 'download', 'Descargar archivos'),
('workflow:cancel', 'workflow', 'cancel', 'Cancelar workflows'),
('task:delegate', 'task', 'delegate', 'Delegar tareas');

COMMIT;
