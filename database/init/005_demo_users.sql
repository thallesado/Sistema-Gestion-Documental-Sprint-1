\set ON_ERROR_STOP on
-- Migración incremental: sirve tanto para volúmenes nuevos como existentes.
-- Ejecutar con psql como propietario/migrador, nunca como nexodocs_app.
-- Amplía el seed de 003 con más datos de demostración: roles y departamentos
-- adicionales para Clínica Central (para igualar la variedad de Acme
-- Consulting) y usuarios hasta llegar a 20 activos por tenant, repartidos en
-- los 3 roles existentes (2 Administrador de tenant, 6 Supervisor, 12 Usuario
-- operativo). Los usuarios y contraseñas son exclusivamente de demostración.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 5);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SELECT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '005_demo_users') AS already_applied \gset
\if :already_applied
  \echo '005_demo_users ya aplicada'
\else

-- Roles adicionales para Clínica Central, mismo patrón que Acme Consulting
INSERT INTO roles (tenant_id, name, description, is_system)
SELECT '20000000-0000-0000-0000-000000000002', v.name, v.description, true
FROM (VALUES
  ('Supervisor', 'Revisión, aprobación y seguimiento.'),
  ('Usuario operativo', 'Operación documental cotidiana.')
) AS v(name, description)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.tenant_id = '20000000-0000-0000-0000-000000000002' AND r.name = 'Supervisor'
  AND p.action IN ('read','create','update','approve','reject','download')
  AND p.module IN ('expedient','document','document_version','workflow','task','notification','report')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.tenant_id = '20000000-0000-0000-0000-000000000002' AND r.name = 'Usuario operativo'
  AND p.action IN ('read','create','update','download')
  AND p.module IN ('expedient','document','document_version','workflow','task','notification')
ON CONFLICT DO NOTHING;

-- Departamentos adicionales para Clínica Central (más variedad para repartir usuarios)
INSERT INTO tenant_departments (tenant_id, name, code) VALUES
('20000000-0000-0000-0000-000000000002', 'Administración', 'ADMIN'),
('20000000-0000-0000-0000-000000000002', 'Radiología', 'RADIO')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Catálogo de nombres para los usuarios nuevos de demostración
CREATE TEMP TABLE tmp_names (idx int, first_name text, last_name text) ON COMMIT DROP;
INSERT INTO tmp_names (idx, first_name, last_name) VALUES
(1,'Sofia','Torres'),(2,'Mateo','Flores'),(3,'Valentina','Rivera'),(4,'Sebastian','Gomez'),
(5,'Isabella','Castro'),(6,'Diego','Morales'),(7,'Camila','Ortiz'),(8,'Nicolas','Silva'),
(9,'Renata','Reyes'),(10,'Emiliano','Vargas'),(11,'Antonella','Romero'),(12,'Joaquin','Suarez'),
(13,'Martina','Aguilar'),(14,'Benjamin','Campos'),(15,'Luciana','Herrera'),(16,'Agustin','Medina'),
(17,'Victoria','Cabrera'),(18,'Tomas','Paredes'),(19,'Regina','Cordero'),(20,'Maximiliano','Nunez');

-- 17 usuarios nuevos para Acme Consulting (ya tiene 3 del seed 003 -> total 20)
-- Distribución: 1 Administrador de tenant, 5 Supervisor, 11 Usuario operativo
WITH depts AS (
  SELECT id, code, row_number() OVER (ORDER BY code) AS rn, count(*) OVER () AS n
  FROM tenant_departments WHERE tenant_id = '20000000-0000-0000-0000-000000000001'
),
new_acme AS (
  SELECT n.idx, n.first_name, n.last_name,
    lower(n.first_name) || '.' || lower(n.last_name) AS uname,
    lower(n.first_name) || '.' || lower(n.last_name) || '@acme.com' AS mail,
    (SELECT d.id FROM depts d WHERE d.rn = ((n.idx - 1) % (SELECT max(n) FROM depts)) + 1) AS dept_id,
    CASE WHEN n.idx <= 1 THEN 'Administrador de tenant'
         WHEN n.idx <= 6 THEN 'Supervisor'
         ELSE 'Usuario operativo' END AS role_name
  FROM tmp_names n WHERE n.idx <= 17
),
ins AS (
  INSERT INTO users (tenant_id, department_id, username, email, password_hash, first_name, last_name, status)
  SELECT '20000000-0000-0000-0000-000000000001', dept_id, uname, mail,
         crypt('DemoPass123!', gen_salt('bf')), first_name, last_name, 'ACTIVE'
  FROM new_acme
  ON CONFLICT (tenant_id, username) DO NOTHING
  RETURNING id, username
)
INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT '20000000-0000-0000-0000-000000000001', ins.id, r.id
FROM ins
JOIN new_acme na ON na.uname = ins.username
JOIN roles r ON r.tenant_id = '20000000-0000-0000-0000-000000000001' AND r.name = na.role_name;

-- 19 usuarios nuevos para Clínica Central (ya tiene 1 del seed 003 -> total 20)
-- Distribución: 1 Administrador de tenant, 6 Supervisor, 12 Usuario operativo
WITH depts AS (
  SELECT id, code, row_number() OVER (ORDER BY code) AS rn, count(*) OVER () AS n
  FROM tenant_departments WHERE tenant_id = '20000000-0000-0000-0000-000000000002'
),
new_clinica AS (
  SELECT n.idx, n.first_name, n.last_name,
    lower(n.first_name) || '.' || lower(n.last_name) AS uname,
    lower(n.first_name) || '.' || lower(n.last_name) || '@clinicacentral.test' AS mail,
    (SELECT d.id FROM depts d WHERE d.rn = ((n.idx - 1) % (SELECT max(n) FROM depts)) + 1) AS dept_id,
    CASE WHEN n.idx <= 1 THEN 'Administrador de tenant'
         WHEN n.idx <= 7 THEN 'Supervisor'
         ELSE 'Usuario operativo' END AS role_name
  FROM tmp_names n WHERE n.idx <= 19
),
ins AS (
  INSERT INTO users (tenant_id, department_id, username, email, password_hash, first_name, last_name, status)
  SELECT '20000000-0000-0000-0000-000000000002', dept_id, uname, mail,
         crypt('DemoPass123!', gen_salt('bf')), first_name, last_name, 'ACTIVE'
  FROM new_clinica
  ON CONFLICT (tenant_id, username) DO NOTHING
  RETURNING id, username
)
INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT '20000000-0000-0000-0000-000000000002', ins.id, r.id
FROM ins
JOIN new_clinica nc ON nc.uname = ins.username
JOIN roles r ON r.tenant_id = '20000000-0000-0000-0000-000000000002' AND r.name = nc.role_name;

INSERT INTO app.schema_migrations(version) VALUES ('005_demo_users');
\endif
COMMIT;
