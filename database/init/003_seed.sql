BEGIN;

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
  CASE WHEN p.code = 'BASIC' THEN features.basic_enabled ELSE true END,
  features.description
FROM plans p
CROSS JOIN (VALUES
  ('workflows', true, 'Flujos documentales'),
  ('ocr_scanning', false, 'Digitalización con OCR'),
  ('custom_branding', false, 'Identidad visual por tenant'),
  ('advanced_analytics', false, 'Reportes avanzados'),
  ('clinical_module', false, 'Especialización clínica'),
  ('dicom_imaging', false, 'Imagenología DICOM')
) AS features(feature_key, basic_enabled, description);

INSERT INTO tenants (id, plan_id, name, code, slug, email, primary_color, subscription_status, subscription_start_date, storage_limit_bytes) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'FinoCode', 'ACME', 'acme', 'documentos@acme.com', '#087f7b', 'ACTIVE', current_date, 26843545600),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Clínica Central', 'CLINICA', 'clinica-central', 'archivo@clinicacentral.test', '#2563eb', 'ACTIVE', current_date, 107374182400);

INSERT INTO tenant_departments (id, tenant_id, name, code) VALUES
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Dirección', 'DIR'),
('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Legal', 'LEGAL'),
('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Archivo', 'ARCH'),
('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Historias clínicas', 'HC');

INSERT INTO users (id, tenant_id, department_id, username, email, password_hash, first_name, last_name, status) VALUES
('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'laura.martinez', 'laura@acme.com', crypt('DemoPass123!', gen_salt('bf')), 'Laura', 'Martínez', 'ACTIVE'),
('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'carlos.mendez', 'carlos@acme.com', crypt('DemoPass123!', gen_salt('bf')), 'Carlos', 'Méndez', 'ACTIVE'),
('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'ana.lopez', 'ana@acme.com', crypt('DemoPass123!', gen_salt('bf')), 'Ana', 'López', 'ACTIVE'),
('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 'maria.rojas', 'maria@clinicacentral.test', crypt('DemoPass123!', gen_salt('bf')), 'María', 'Rojas', 'ACTIVE');

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

INSERT INTO roles (tenant_id, name, description, is_system) VALUES
('20000000-0000-0000-0000-000000000001', 'Administrador de tenant', 'Administración completa de Acme Consulting.', true),
('20000000-0000-0000-0000-000000000001', 'Supervisor', 'Revisión, aprobación y seguimiento.', true),
('20000000-0000-0000-0000-000000000001', 'Usuario operativo', 'Operación documental cotidiana.', true),
('20000000-0000-0000-0000-000000000002', 'Administrador de tenant', 'Administración completa de Clínica Central.', true);

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Administrador de tenant';

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p ON
  p.action IN ('read','create','update','approve','reject','download')
  AND p.module IN ('expedient','document','document_version','workflow','task','notification','report')
WHERE r.name = 'Supervisor';

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p ON
  p.action IN ('read','create','update','download')
  AND p.module IN ('expedient','document','document_version','workflow','task','notification')
WHERE r.name = 'Usuario operativo';

INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT u.tenant_id, u.id, r.id FROM users u JOIN roles r ON r.tenant_id = u.tenant_id
WHERE (u.username = 'laura.martinez' AND r.name = 'Administrador de tenant')
   OR (u.username = 'carlos.mendez' AND r.name = 'Supervisor')
   OR (u.username = 'ana.lopez' AND r.name = 'Usuario operativo')
   OR (u.username = 'maria.rojas' AND r.name = 'Administrador de tenant');

INSERT INTO retention_policies (id, tenant_id, name, retention_months, disposition_action) VALUES
('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Contractual 5 años', 60, 'REVIEW'),
('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Clínica permanente', NULL, 'ARCHIVE');

INSERT INTO document_categories (id, tenant_id, name, code) VALUES
('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Legal', 'LEGAL'),
('51000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Clínico', 'CLINICAL');

INSERT INTO document_types (id, tenant_id, category_id, retention_policy_id, name, code, metadata_schema) VALUES
('52000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Contrato', 'CONTRACT', '{"required":["supplier","effectiveDate"]}'),
('52000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Historia clínica', 'CLINICAL_HISTORY', '{"required":["patient"]}');

INSERT INTO expedient_types (id, tenant_id, name, code) VALUES
('53000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Expediente de proveedor', 'SUPPLIER'),
('53000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Expediente clínico', 'CLINICAL');

INSERT INTO expedients (id, tenant_id, expedient_type_id, responsible_id, department_id, code, name, description) VALUES
('54000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'EXP-2041', 'Alta de proveedor Andes', 'Documentación contractual del proveedor.'),
('54000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'HC-1001', 'Expediente clínico de demostración', 'Especialización clínica del expediente documental.');

INSERT INTO documents (id, tenant_id, expedient_id, document_type_id, author_id, responsible_id, department_id, code, name, description, status, issue_date) VALUES
('55000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'DOC-2041', 'Contrato marco proveedores 2026', 'Contrato sujeto a revisión y aprobación.', 'IN_REVIEW', current_date),
('55000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '54000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'HC-DOC-1001', 'Consentimiento informado', 'Documento clínico de demostración.', 'APPROVED', current_date);

INSERT INTO document_versions (tenant_id, document_id, version_number, author_id, change_reason, file_name, mime_type, file_size_bytes, checksum_sha256) VALUES
('20000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', 1, '40000000-0000-0000-0000-000000000001', 'Versión inicial', 'contrato-marco.pdf', 'application/pdf', 245760, repeat('a', 64)),
('20000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000002', 1, '40000000-0000-0000-0000-000000000004', 'Documento inicial', 'consentimiento.pdf', 'application/pdf', 153600, repeat('b', 64));

INSERT INTO workflow_templates (id, tenant_id, name, description, created_by) VALUES
('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Aprobación de contratos', 'Revisión legal y aprobación final.', '40000000-0000-0000-0000-000000000001');

INSERT INTO workflow_template_stages (id, tenant_id, workflow_template_id, name, stage_type, sort_order, assignment_type, assignment_reference, due_days) VALUES
('61000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Inicio', 'START', 1, NULL, NULL, 0),
('61000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Revisión legal', 'REVIEW', 2, 'ROLE', 'Supervisor', 2),
('61000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Aprobación', 'APPROVAL', 3, 'ROLE', 'Administrador de tenant', 1),
('61000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Fin', 'END', 4, NULL, NULL, 0);

INSERT INTO workflow_template_transitions (tenant_id, workflow_template_id, from_stage_id, to_stage_id, name) VALUES
('20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'Enviar a revisión'),
('20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000003', 'Aprobar revisión'),
('20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000004', 'Publicar');

UPDATE document_types SET workflow_template_id = '60000000-0000-0000-0000-000000000001'
WHERE id = '52000000-0000-0000-0000-000000000001';

INSERT INTO workflows (id, tenant_id, workflow_template_id, expedient_id, title, description, status, creator_id, current_stage_id, started_at, due_at) VALUES
('62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', 'Aprobación de contrato marco', 'Workflow de demostración.', 'IN_PROGRESS', '40000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', now(), now() + interval '2 days');

INSERT INTO workflow_documents (tenant_id, workflow_id, document_id) VALUES
('20000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001');

INSERT INTO workflow_tasks (id, tenant_id, workflow_id, stage_id, document_id, title, assigned_user_id, status, priority, document_version, due_at) VALUES
('63000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000001', 'Revisar contrato marco', '40000000-0000-0000-0000-000000000002', 'PENDING', 2, 1, now() + interval '2 days');

INSERT INTO notifications (tenant_id, user_id, type, title, message, related_entity_type, related_entity_id) VALUES
('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'TASK_ASSIGNED', 'Nueva tarea asignada', 'Debes revisar el contrato marco.', 'workflow_task', '63000000-0000-0000-0000-000000000001');

INSERT INTO audit_events (tenant_id, user_id, action, entity_type, entity_id, result, details) VALUES
('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'DOCUMENT_CREATED', 'document', '55000000-0000-0000-0000-000000000001', 'SUCCESS', '{"version":1}'),
('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'DOCUMENT_CREATED', 'document', '55000000-0000-0000-0000-000000000002', 'SUCCESS', '{"version":1}');

INSERT INTO patients (id, tenant_id, document_type, document_number, first_name, last_name, birth_date) VALUES
('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'CI', '12345678', 'Paciente', 'Demostración', DATE '1990-01-15');

INSERT INTO clinical_histories (id, tenant_id, patient_id, code, blood_type, allergies, observations) VALUES
('71000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'HC-1001', 'O+', '[{"allergen":"Penicilina","severity":"HIGH","reaction":"Erupción"}]', 'Historia clínica de demostración.');

INSERT INTO clinical_document_links (tenant_id, document_id, patient_id, clinical_history_id) VALUES
('20000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');

COMMIT;
