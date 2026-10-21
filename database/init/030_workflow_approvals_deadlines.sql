\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 30);
SELECT EXISTS(SELECT 1 FROM app.schema_migrations WHERE version='030_workflow_approvals_deadlines') AS already_applied \gset
\if :already_applied
  \echo '030_workflow_approvals_deadlines ya aplicada'
\else

ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS due_soon_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_notified_at timestamptz;

-- Replace the legacy short UUID display codes with readable tenant-scoped codes.
WITH existing AS (
  SELECT tenant_id,to_char(created_at,'YYYY') AS year,
    max(substring(code from '^WF-[0-9]{4}-([0-9]{6})$')::bigint) AS max_number
  FROM workflows WHERE code ~ '^WF-[0-9]{4}-[0-9]{6}$'
  GROUP BY tenant_id,to_char(created_at,'YYYY')
), numbered AS (
  SELECT w.id,w.tenant_id,'WF-'||to_char(w.created_at,'YYYY')||'-'||
    lpad((coalesce(e.max_number,0)+row_number() OVER(PARTITION BY w.tenant_id,to_char(w.created_at,'YYYY') ORDER BY w.created_at,w.id))::text,
      GREATEST(6,length((coalesce(e.max_number,0)+row_number() OVER(PARTITION BY w.tenant_id,to_char(w.created_at,'YYYY') ORDER BY w.created_at,w.id))::text)),'0') AS new_code
  FROM workflows w LEFT JOIN existing e ON e.tenant_id=w.tenant_id AND e.year=to_char(w.created_at,'YYYY')
  WHERE w.code ~ '^WF-[0-9a-fA-F]{8}$'
)
UPDATE workflows w SET code=n.new_code FROM numbered n WHERE w.tenant_id=n.tenant_id AND w.id=n.id;
INSERT INTO workflow_codes(tenant_id,next_number)
SELECT tenant_id,count(*)+1 FROM workflows GROUP BY tenant_id
ON CONFLICT(tenant_id) DO UPDATE SET next_number=GREATEST(workflow_codes.next_number,EXCLUDED.next_number);

CREATE TABLE workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL,
  step_id uuid NOT NULL,
  task_id uuid NOT NULL,
  approver_user_id uuid NOT NULL,
  decision varchar(20) NOT NULL CHECK (decision IN ('APPROVED','REJECTED','RETURNED')),
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,task_id,approver_user_id),
  FOREIGN KEY (tenant_id,workflow_id) REFERENCES workflows(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,step_id) REFERENCES workflow_steps(tenant_id,id),
  FOREIGN KEY (tenant_id,task_id) REFERENCES workflow_tasks(tenant_id,id),
  FOREIGN KEY (tenant_id,approver_user_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX idx_workflow_approvals_task ON workflow_approvals(tenant_id,task_id,decided_at DESC);
CREATE INDEX idx_workflow_approvals_approver ON workflow_approvals(tenant_id,approver_user_id,decided_at DESC);
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_approvals_tenant ON workflow_approvals
  USING (tenant_id=app.current_tenant_id() AND app.context_is_valid() AND app.has_permission('workflow:read'))
  WITH CHECK (tenant_id=app.current_tenant_id() AND app.context_is_valid()
    AND approver_user_id=app.current_user_id()
    AND (app.has_permission('workflow:approve') OR app.has_permission('workflow:reject') OR app.has_permission('workflow:return')));
GRANT SELECT,INSERT ON workflow_approvals TO nexodocs_app;
REVOKE UPDATE,DELETE ON workflow_approvals FROM nexodocs_app,nexodocs_platform_admin;

CREATE TABLE workflow_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL,
  step_id uuid NOT NULL,
  task_id uuid NOT NULL,
  label varchar(500) NOT NULL,
  required boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,task_id,label),
  FOREIGN KEY (tenant_id,workflow_id) REFERENCES workflows(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,step_id) REFERENCES workflow_steps(tenant_id,id),
  FOREIGN KEY (tenant_id,task_id) REFERENCES workflow_tasks(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,completed_by) REFERENCES users(tenant_id,id),
  CHECK ((completed AND completed_by IS NOT NULL AND completed_at IS NOT NULL)
      OR (NOT completed AND completed_by IS NULL AND completed_at IS NULL))
);
CREATE INDEX idx_workflow_checklist_task ON workflow_checklist_items(tenant_id,task_id,required,completed);
ALTER TABLE workflow_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_checklist_items FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_checklist_tenant ON workflow_checklist_items
  USING (tenant_id=app.current_tenant_id() AND app.context_is_valid()
    AND (app.has_permission('task:read') OR app.has_permission('workflow:read')))
  WITH CHECK (tenant_id=app.current_tenant_id() AND app.context_is_valid()
    AND (app.has_permission('task:create') OR app.has_permission('task:update')));
GRANT SELECT,INSERT,UPDATE ON workflow_checklist_items TO nexodocs_app;
REVOKE DELETE ON workflow_checklist_items FROM nexodocs_app,nexodocs_platform_admin;
CREATE TRIGGER trg_workflow_checklist_updated_at BEFORE UPDATE ON workflow_checklist_items
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Migrate the existing JSON checklist without losing completed selections.
INSERT INTO workflow_checklist_items(tenant_id,workflow_id,step_id,task_id,label,required,completed,completed_by,completed_at)
SELECT q.tenant_id,q.workflow_id,q.workflow_step_id,q.id,item.label,true,
       coalesce((q.checklist_results->>item.label)::boolean,false),
       CASE WHEN coalesce((q.checklist_results->>item.label)::boolean,false) THEN coalesce(q.completed_by,q.assigned_user_id) END,
       CASE WHEN coalesce((q.checklist_results->>item.label)::boolean,false) THEN coalesce(q.completed_at,q.updated_at) END
FROM workflow_tasks q
JOIN workflow_template_stages s ON s.tenant_id=q.tenant_id AND s.id=q.stage_id
CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(s.rules->'checklist','[]'::jsonb)) AS item(label)
WHERE q.workflow_step_id IS NOT NULL
ON CONFLICT (tenant_id,task_id,label) DO NOTHING;

-- The workflow event stream remains the source of truth. This narrow function
-- mirrors its domain events into the shared, append-only audit log.
CREATE OR REPLACE FUNCTION app.record_workflow_audit(
  p_action text,p_workflow_id uuid,p_task_id uuid,p_step_id uuid,p_document_id uuid,
  p_expedient_id uuid,p_from_status text,p_to_status text,p_metadata jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,app,pg_temp AS $$
BEGIN
  IF NOT app.context_is_valid() OR app.current_tenant_id() IS NULL OR app.current_user_id() IS NULL THEN
    RAISE EXCEPTION 'Contexto de tenant requerido' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action !~ '^WORKFLOW_[A-Z0-9_]{1,70}$' THEN
    RAISE EXCEPTION 'Acción de auditoría inválida' USING ERRCODE='22023';
  END IF;
  IF p_action LIKE 'WORKFLOW_TEMPLATE_%' THEN
    IF NOT (app.has_permission('workflow_template:create') OR app.has_permission('workflow_template:update')
      OR app.has_permission('workflow_template:delete') OR app.has_permission('workflow:designer')) THEN
      RAISE EXCEPTION 'Permiso requerido para auditar plantilla' USING ERRCODE='42501';
    END IF;
  ELSIF NOT (app.has_permission('workflow:create') OR app.has_permission('workflow:start')
      OR app.has_permission('workflow:update') OR app.has_permission('workflow:pause')
      OR app.has_permission('workflow:cancel') OR app.has_permission('task:create')
      OR app.has_permission('task:update') OR app.has_permission('workflow:approve')
      OR app.has_permission('workflow:review') OR app.has_permission('workflow:reject')
      OR app.has_permission('workflow:return')) THEN
    RAISE EXCEPTION 'Permiso requerido para auditar workflow' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.audit_events(tenant_id,user_id,action,entity_type,entity_id,details)
  VALUES(app.current_tenant_id(),app.current_user_id(),p_action,'WORKFLOW',p_workflow_id,
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'workflowId',p_workflow_id,'taskId',p_task_id,'stepId',p_step_id,
      'documentId',p_document_id,'expedientId',p_expedient_id,
      'fromStatus',p_from_status,'toStatus',p_to_status,
      'user',app.current_user_id(),'timestamp',clock_timestamp(),
      'tenant',app.current_tenant_id()));
END;
$$;
ALTER FUNCTION app.record_workflow_audit(text,uuid,uuid,uuid,uuid,uuid,text,text,jsonb) OWNER TO nexodocs_security;
REVOKE ALL ON FUNCTION app.record_workflow_audit(text,uuid,uuid,uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_workflow_audit(text,uuid,uuid,uuid,uuid,uuid,text,text,jsonb) TO nexodocs_app;

-- One scheduler call atomically flags due tasks and emits exactly one notice
-- and audit event per deadline. The function runs with its restricted owner.
GRANT SELECT ON workflow_tasks,workflows TO nexodocs_security;
GRANT UPDATE(status,due_soon_notified_at,expired_notified_at,updated_at) ON workflow_tasks TO nexodocs_security;
GRANT INSERT ON workflow_events,notifications TO nexodocs_security;
GRANT USAGE ON SCHEMA public,app TO nexodocs_security;
CREATE OR REPLACE FUNCTION app.process_workflow_deadlines() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,app,pg_temp AS $$
DECLARE item record; processed integer:=0; event_name text;
BEGIN
  FOR item IN
    SELECT q.id AS task_id,q.tenant_id,q.workflow_id,q.workflow_step_id,q.document_id,
      q.assigned_user_id,q.title AS task_title,q.due_at,q.status AS task_status,
      w.title AS workflow_title,w.code AS workflow_code,w.status AS workflow_status,
      w.expedient_id,w.current_stage_id
    FROM public.workflow_tasks q
    JOIN public.workflows w ON w.tenant_id=q.tenant_id AND w.id=q.workflow_id
    WHERE w.status IN ('STARTED','IN_PROGRESS') AND w.deleted_at IS NULL
      AND q.due_at IS NOT NULL AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')
      AND ((q.due_at<=clock_timestamp() AND q.expired_notified_at IS NULL)
        OR (q.due_at>clock_timestamp() AND q.due_at<=clock_timestamp()+interval '24 hours' AND q.due_soon_notified_at IS NULL))
    ORDER BY q.due_at
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    IF item.due_at<=clock_timestamp() THEN
      event_name:='TASK_EXPIRED';
      UPDATE public.workflow_tasks SET status='OVERDUE',expired_notified_at=clock_timestamp(),updated_at=clock_timestamp()
        WHERE tenant_id=item.tenant_id AND id=item.task_id;
      INSERT INTO public.notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id)
      VALUES(item.tenant_id,item.assigned_user_id,'TASK_EXPIRED','Tarea vencida',item.task_title||' · '||item.workflow_title,'workflow_task',item.task_id);
    ELSE
      event_name:='TASK_DUE_SOON';
      UPDATE public.workflow_tasks SET due_soon_notified_at=clock_timestamp(),updated_at=clock_timestamp()
        WHERE tenant_id=item.tenant_id AND id=item.task_id;
      INSERT INTO public.notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id)
      VALUES(item.tenant_id,item.assigned_user_id,'TASK_DUE_SOON','Tarea próxima a vencer',item.task_title||' · '||item.workflow_title,'workflow_task',item.task_id);
    END IF;
    INSERT INTO public.workflow_events(tenant_id,workflow_id,task_id,document_id,event_type,result,details)
    VALUES(item.tenant_id,item.workflow_id,item.task_id,item.document_id,event_name,item.task_status::text,
      jsonb_build_object('scheduled',true,'dueAt',item.due_at,'fromStatus',item.task_status,'toStatus',
        CASE WHEN event_name='TASK_EXPIRED' THEN 'OVERDUE' ELSE item.task_status::text END,
        'workflowId',item.workflow_id,'taskId',item.task_id,'stepId',item.workflow_step_id,
        'documentId',item.document_id,'expedientId',item.expedient_id,'tenant',item.tenant_id,'timestamp',clock_timestamp()));
    INSERT INTO public.audit_events(tenant_id,action,entity_type,entity_id,details)
    VALUES(item.tenant_id,'WORKFLOW_'||event_name,'WORKFLOW',item.workflow_id,
      jsonb_build_object('workflowId',item.workflow_id,'taskId',item.task_id,'stepId',item.workflow_step_id,
        'documentId',item.document_id,'expedientId',item.expedient_id,'fromStatus',item.task_status,
        'toStatus',CASE WHEN event_name='TASK_EXPIRED' THEN 'OVERDUE' ELSE item.task_status::text END,
        'user',NULL,'timestamp',clock_timestamp(),'tenant',item.tenant_id,'dueAt',item.due_at,'scheduled',true));
    processed:=processed+1;
  END LOOP;
  RETURN processed;
END;
$$;
ALTER FUNCTION app.process_workflow_deadlines() OWNER TO nexodocs_security;
REVOKE ALL ON FUNCTION app.process_workflow_deadlines() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.process_workflow_deadlines() TO nexodocs_app;

INSERT INTO app.schema_migrations(version) VALUES ('030_workflow_approvals_deadlines') ON CONFLICT DO NOTHING;
\endif
COMMIT;
