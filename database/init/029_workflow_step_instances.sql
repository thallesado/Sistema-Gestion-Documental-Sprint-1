\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 29);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='029_workflow_step_instances') AS already_applied \gset
\if :already_applied
  \echo '029_workflow_step_instances ya aplicada'
\else

CREATE TABLE workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL,
  template_step_id uuid,
  name varchar(200) NOT NULL,
  description text,
  step_type varchar(30) NOT NULL,
  order_index integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','ACTIVE','COMPLETED','CANCELED','SKIPPED')),
  result varchar(50),
  started_at timestamptz,
  completed_at timestamptz,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,workflow_id) REFERENCES workflows(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,template_step_id) REFERENCES workflow_template_stages(tenant_id,id)
);
CREATE INDEX idx_workflow_steps_instance ON workflow_steps(tenant_id,workflow_id,created_at);

ALTER TABLE workflows ADD COLUMN current_step_instance_id uuid;
ALTER TABLE workflow_tasks ADD COLUMN workflow_step_id uuid;
ALTER TABLE workflows ADD CONSTRAINT fk_workflow_current_step_instance
  FOREIGN KEY(tenant_id,current_step_instance_id) REFERENCES workflow_steps(tenant_id,id);
ALTER TABLE workflow_tasks ADD CONSTRAINT fk_workflow_task_step_instance
  FOREIGN KEY(tenant_id,workflow_step_id) REFERENCES workflow_steps(tenant_id,id);

-- Conserva tareas históricas creando una instancia equivalente por tarea.
INSERT INTO workflow_steps(id,tenant_id,workflow_id,template_step_id,name,description,step_type,order_index,status,result,started_at,completed_at,due_at,created_at,updated_at)
SELECT task.id,task.tenant_id,task.workflow_id,task.stage_id,task.title,task.description,
  coalesce(stage.stage_type,'TASK'),coalesce(stage.sort_order,0),
  CASE WHEN task.status::text IN ('PENDING','IN_PROGRESS','OVERDUE') THEN 'ACTIVE'
       WHEN task.status::text='CANCELED' THEN 'CANCELED' ELSE 'COMPLETED' END,
  task.outcome::text,task.started_at,task.completed_at,task.due_at,task.created_at,task.updated_at
FROM workflow_tasks task
LEFT JOIN workflow_template_stages stage ON stage.tenant_id=task.tenant_id AND stage.id=task.stage_id
ON CONFLICT(id) DO NOTHING;
UPDATE workflow_tasks SET workflow_step_id=id WHERE workflow_step_id IS NULL;

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_steps_tenant ON workflow_steps
  USING(tenant_id=app.current_tenant_id()) WITH CHECK(tenant_id=app.current_tenant_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON workflow_steps TO nexodocs_app;

-- Vista de compatibilidad: el historial inmutable existente es la transición
-- ejecutada. No se duplica la misma verdad en dos tablas editables.
CREATE VIEW workflow_transitions WITH (security_invoker=true) AS
SELECT id,tenant_id,workflow_id,
  NULLIF(details->>'fromStage','')::uuid AS from_step_id,
  NULLIF(details->>'toStage','')::uuid AS to_step_id,
  event_type AS action,performed_by,comment,details AS metadata,performed_at AS created_at
FROM workflow_events;
GRANT SELECT ON workflow_transitions TO nexodocs_app;

INSERT INTO app.schema_migrations(version) VALUES ('029_workflow_step_instances') ON CONFLICT DO NOTHING;
\endif
COMMIT;
