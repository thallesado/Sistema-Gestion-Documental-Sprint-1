\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 23);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations
  WHERE version = '023_clinical_history_revisions'
) AS already_applied \gset

\if :already_applied
  \echo '023_clinical_history_revisions ya aplicada'
\else
  -- 1. Crear tabla de revisiones históricas de historias clínicas
  CREATE TABLE IF NOT EXISTS clinical_history_revisions (
    id uuid DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    clinical_history_id uuid NOT NULL REFERENCES clinical_histories(id) ON DELETE CASCADE,
    revision_number int NOT NULL,
    author_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    change_summary text NOT NULL,
    snapshot_data jsonb NOT NULL,
    PRIMARY KEY (tenant_id, id)
  );

  -- 2. Habilitar y forzar Row Level Security (RLS)
  ALTER TABLE clinical_history_revisions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE clinical_history_revisions FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation ON clinical_history_revisions;
  CREATE POLICY tenant_isolation ON clinical_history_revisions
    FOR ALL
    USING (tenant_id = app.current_tenant_id())
    WITH CHECK (tenant_id = app.current_tenant_id());

  -- 3. Índice para ordenamiento y búsqueda rápida por expediente
  CREATE INDEX IF NOT EXISTS idx_clinical_history_revisions_history
    ON clinical_history_revisions (tenant_id, clinical_history_id, revision_number DESC);

  -- 4. Otorgar permisos DML al rol de la aplicación
  GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_history_revisions TO nexodocs_app;

  -- 5. Registrar permiso granular en el catálogo
  INSERT INTO permissions (code, module, action, description) VALUES
    ('clinical_history:revision_read', 'clinical', 'read', 'Consultar revisiones históricas del expediente')
  ON CONFLICT (code) DO NOTHING;

  -- 6. Asignar el permiso a los roles clínicos y administrativos
  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r CROSS JOIN permissions p
  WHERE r.name IN ('Administrador de tenant', 'Supervisor', 'Usuario operativo')
    AND p.code = 'clinical_history:revision_read'
  ON CONFLICT DO NOTHING;

  INSERT INTO app.schema_migrations(version) VALUES ('023_clinical_history_revisions');
\endif

COMMIT;
