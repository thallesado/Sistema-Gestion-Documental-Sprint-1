\set ON_ERROR_STOP on
-- Seed incremental y exclusivamente demostrativo para FinoCode.
-- Las contraseñas comparten el valor documentado en database/README.md.
-- crypt(..., gen_salt('bf')) genera hashes BCrypt compatibles con Spring Security.
BEGIN;
SELECT pg_advisory_xact_lock(726394, 15);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '015_acme_superadmin_demo_users'
) AS already_applied \gset
\if :already_applied
  \echo '015_acme_superadmin_demo_users ya aplicada'
\else
  CREATE TEMP TABLE tmp_acme_demo_users (
    username text PRIMARY KEY,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role_name text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_acme_demo_users(username, email, first_name, last_name, role_name) VALUES
    ('andres.superadmin', 'andres.superadmin@acme.example.invalid', 'Andres', 'Superadministrador', 'Superadministrador'),
    ('edixon.superadmin', 'edixon.superadmin@acme.example.invalid', 'Edixon', 'Superadministrador', 'Superadministrador'),
    ('oscar.superadmin', 'oscar.superadmin@acme.example.invalid', 'Oscar', 'Superadministrador', 'Superadministrador'),
    ('diego.superadmin', 'diego.superadmin@acme.example.invalid', 'Diego', 'Superadministrador', 'Superadministrador'),
    ('denilson.superadmin', 'denilson.superadmin@acme.example.invalid', 'Denilson', 'Superadministrador', 'Superadministrador'),
    ('mauricio.superadmin', 'mauricio.superadmin@acme.example.invalid', 'Mauricio', 'Superadministrador', 'Superadministrador'),
    ('acme.supervisor.test', 'acme.supervisor.test@acme.example.invalid', 'Usuario', 'Supervisor', 'Supervisor'),
    ('acme.operativo.test', 'acme.operativo.test@acme.example.invalid', 'Usuario', 'Operativo', 'Usuario operativo'),
    ('acme.supervisor.test2', 'acme.supervisor.test2@acme.example.invalid', 'Prueba', 'Supervisor', 'Supervisor'),
    ('acme.operativo.test2', 'acme.operativo.test2@acme.example.invalid', 'Prueba', 'Operativo', 'Usuario operativo');

  INSERT INTO roles (tenant_id, name, description, is_system)
  VALUES (
    '20000000-0000-0000-0000-000000000001',
    'Superadministrador',
    'Cuenta de demostración con permisos completos dentro de FinoCode.',
    true
  )
  ON CONFLICT (tenant_id, name) DO NOTHING;

  INSERT INTO users (
    tenant_id, username, email, password_hash, first_name, last_name, status
  )
  SELECT
    '20000000-0000-0000-0000-000000000001',
    d.username,
    d.email,
    crypt('DemoPass123!', gen_salt('bf')),
    d.first_name,
    d.last_name,
    'ACTIVE'
  FROM tmp_acme_demo_users d
  ON CONFLICT (tenant_id, username) DO NOTHING;

  INSERT INTO user_roles (tenant_id, user_id, role_id)
  SELECT
    '20000000-0000-0000-0000-000000000001',
    u.id,
    r.id
  FROM users u
  JOIN tmp_acme_demo_users d ON d.username = u.username
  JOIN roles r
    ON r.tenant_id = u.tenant_id
   AND r.name = d.role_name
  WHERE u.tenant_id = '20000000-0000-0000-0000-000000000001'
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.tenant_id = '20000000-0000-0000-0000-000000000001'
    AND r.name = 'Superadministrador'
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version)
  VALUES ('015_acme_superadmin_demo_users');
\endif
COMMIT;
