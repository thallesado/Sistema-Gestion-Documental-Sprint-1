\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 26);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='026_workflow_engine') AS already_applied \gset
\if :already_applied
  \echo '026_workflow_engine ya aplicada'
\else
ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_rank smallint NOT NULL DEFAULT 10 CHECK (approval_rank BETWEEN 0 AND 100);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS workflow_owner boolean NOT NULL DEFAULT false;
UPDATE roles SET approval_rank = CASE WHEN name = 'Superadministrador' THEN 100
  WHEN name = 'Administrador de tenant' THEN 80 WHEN name = 'Supervisor' THEN 50 ELSE approval_rank END,
  workflow_owner = (name = 'Superadministrador')
WHERE name IN ('Superadministrador','Administrador de tenant','Supervisor');
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS category varchar(100) NOT NULL DEFAULT 'Documental';
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS origin_type varchar(20) NOT NULL DEFAULT 'ANY'
  CHECK (origin_type IN ('ANY','DOCUMENT','EXPEDIENT','INDEPENDENT'));
ALTER TABLE workflow_templates ADD COLUMN IF NOT EXISTS family_id uuid;
-- Administrative backfill only; used-template protection is restored in the
-- same transaction and stays enabled for all application writes.
ALTER TABLE workflow_templates DISABLE TRIGGER trg_used_template;
UPDATE workflow_templates SET family_id=id WHERE family_id IS NULL;
ALTER TABLE workflow_templates ENABLE TRIGGER trg_used_template;
ALTER TABLE workflow_templates ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS code varchar(40);
UPDATE workflows SET code='WF-'||substr(id::text,1,8) WHERE code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_code ON workflows(tenant_id, code);
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS category varchar(100) NOT NULL DEFAULT 'Documental';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS assignments jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS last_outcome varchar(30) NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS checklist_results jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS return_stage_id uuid;
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS correction boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS workflow_codes (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id), next_number bigint NOT NULL DEFAULT 1
);
ALTER TABLE workflow_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_codes_tenant ON workflow_codes;
CREATE POLICY workflow_codes_tenant ON workflow_codes USING (tenant_id=app.current_tenant_id())
  WITH CHECK (tenant_id=app.current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON workflow_codes TO nexodocs_app;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fk_workflow_department') THEN
    ALTER TABLE workflows ADD CONSTRAINT fk_workflow_department FOREIGN KEY(tenant_id, department_id)
      REFERENCES tenant_departments(tenant_id,id);
    ALTER TABLE workflow_tasks ADD CONSTRAINT fk_workflow_return_stage FOREIGN KEY(tenant_id,workflow_template_id,return_stage_id)
      REFERENCES workflow_template_stages(tenant_id,workflow_template_id,id);
  END IF;
END $$;
ALTER TABLE workflow_template_stages DROP CONSTRAINT IF EXISTS workflow_template_stages_stage_type_check;
ALTER TABLE workflow_template_stages ADD CONSTRAINT workflow_template_stages_stage_type_check
  CHECK(stage_type IN ('START','TASK','REVIEW','APPROVAL','DECISION','NOTIFICATION','ARCHIVE','END'));
INSERT INTO permissions(code,module,action,description)
SELECT 'workflow:'||action,'workflow',action,description FROM (VALUES
 ('start','Iniciar workflows'),('pause','Pausar y reanudar workflows'),('cancel','Cancelar workflows'),
 ('complete','Completar workflows'),('review','Revisar tareas'),('approve','Aprobar tareas'),
 ('reject','Rechazar tareas'),('return','Devolver para corrección'),('assign','Escalar y asignar tareas'),
 ('designer','Diseñar plantillas')) AS actions(action,description)
ON CONFLICT(code) DO NOTHING;
INSERT INTO permissions(code,module,action,description)
SELECT 'workflow_template:'||action,'workflow_template',action,'Plantillas: '||action
FROM unnest(ARRAY['read','create','update','delete']) AS action ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE (r.name IN ('Superadministrador','Administrador de tenant') AND
  (p.module IN ('workflow','workflow_template','task','notification') OR p.code IN ('document:approve','document:reject','document:update')))
 OR (r.name='Supervisor' AND p.code IN ('workflow:read','workflow:create','workflow:update','workflow:start',
   'workflow:review','workflow:approve','workflow:reject','workflow:return','workflow:assign','task:read','task:create','task:update',
   'workflow_template:read','notification:create','notification:read','document:approve','document:reject','document:update'))
 OR (r.name='Usuario operativo' AND p.code IN ('workflow:read','workflow:create','workflow:update','workflow:start',
   'task:read','task:create','task:update','workflow_template:read','notification:create','notification:read','document:update'))
ON CONFLICT DO NOTHING;
-- Task actor may change workflow/documents while executing a transition, but
-- capabilities and assignment are checked by the backend before any mutation.
GRANT SELECT(approval_rank,workflow_owner) ON roles TO nexodocs_app;
INSERT INTO app.schema_migrations(version) VALUES ('026_workflow_engine') ON CONFLICT DO NOTHING;
\endif
COMMIT;
