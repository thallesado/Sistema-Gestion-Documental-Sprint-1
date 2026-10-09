BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 33);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '033_expedient_type_management'
) AS already_applied \gset
\if :already_applied
  \echo '033_expedient_type_management ya aplicada'
\else

INSERT INTO permissions (code, module, action, description)
VALUES ('expedient_type:create', 'expedient_type', 'create', 'Crear tipos de expediente')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'expedient_type:create'
WHERE r.name = 'Administrador de tenant'
ON CONFLICT DO NOTHING;

INSERT INTO app.schema_migrations(version)
VALUES ('033_expedient_type_management') ON CONFLICT DO NOTHING;
\endif
COMMIT;
