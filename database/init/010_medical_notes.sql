\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(726394, 4);
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (SELECT 1 FROM app.schema_migrations
  WHERE version = '010_medical_notes') AS already_applied \gset
\if :already_applied
  \echo '010_medical_notes ya aplicada'
\else
  -- Corrige la función heredada de 008: un trigger sobre tenants no puede
  -- evaluar NEW.status (esa columna solo existe en users).
  CREATE OR REPLACE FUNCTION app.validate_tenant_user_status()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF TG_TABLE_NAME = 'users' THEN
      IF NEW.status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN
        RAISE EXCEPTION 'Estado de usuario inválido';
      END IF;
    ELSIF TG_TABLE_NAME = 'tenants' THEN
      IF NEW.subscription_status NOT IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELED') THEN
        RAISE EXCEPTION 'Estado de suscripción inválido';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE TABLE medical_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    clinical_history_id uuid NOT NULL,
    episode_id uuid,
    author_id uuid NOT NULL,
    note_type varchar(40) NOT NULL,
    content text NOT NULL CHECK (btrim(content) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, clinical_history_id) REFERENCES clinical_histories(tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, author_id) REFERENCES users(tenant_id, id),
    FOREIGN KEY (tenant_id, clinical_history_id, episode_id)
      REFERENCES clinical_episodes(tenant_id, clinical_history_id, id)
  );
  CREATE INDEX idx_medical_notes_history_created
    ON medical_notes (tenant_id, clinical_history_id, created_at DESC);
  ALTER TABLE medical_notes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE medical_notes FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON medical_notes
    USING (tenant_id = app.current_tenant_id())
    WITH CHECK (tenant_id = app.current_tenant_id());
  GRANT SELECT, INSERT ON medical_notes TO nexodocs_app;

  INSERT INTO permissions (code, module, action, description) VALUES
    ('medical_note:read','medical_note','read','Consultar notas médicas'),
    ('medical_note:create','medical_note','create','Crear notas médicas')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO role_permissions (tenant_id, role_id, permission_id)
  SELECT r.tenant_id, r.id, p.id
  FROM roles r CROSS JOIN permissions p
  WHERE r.name IN ('Administrador de tenant', 'Supervisor', 'Usuario operativo')
    AND p.code IN ('medical_note:read', 'medical_note:create')
  ON CONFLICT DO NOTHING;
  INSERT INTO app.schema_migrations(version) VALUES ('010_medical_notes');
\endif
COMMIT;
