BEGIN;

INSERT INTO permissions (code, module, action, description)
VALUES ('expedient_type:create', 'expedient_type', 'create', 'Crear tipos de expediente')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'expedient_type:create'
WHERE r.name = 'Administrador de tenant'
ON CONFLICT DO NOTHING;

COMMIT;
