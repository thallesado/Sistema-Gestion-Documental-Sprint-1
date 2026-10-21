package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.WorkflowRequests.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.exception.NotFoundException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;
import java.time.OffsetDateTime;
import java.text.Normalizer;

/** Sequential tenant-aware engine. Every action locks its workflow before its task. */
@Service
@Transactional
public class WorkflowEngineService {
    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;
    private final ObjectMapper mapper;
    public WorkflowEngineService(NamedParameterJdbcTemplate db,AuthenticatedUserContext context,ObjectMapper mapper) {
        this.db=db;this.context=context;this.mapper=mapper;
    }
    private Map<String,Object> scope() {
        context.establishDatabaseContext();
        Map<String,Object> p=new HashMap<>(); p.put("tenant",context.requireTenantId());p.put("actor",context.requireUserId());return p;
    }
    private void permit(String permission) {
        if(!context.hasAuthority(permission)) throw new AccessDeniedException("Permiso requerido: "+permission);
    }
    private void conflict(String message) { throw new ResponseStatusException(HttpStatus.CONFLICT,message); }
    private String json(Object value) {
        try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException("JSON inválido");}
    }
    private Object parse(Object value) {
        if(value==null)return null;
        try{return mapper.readValue(value.toString(),Object.class);}catch(Exception e){throw new IllegalArgumentException("Datos JSON inválidos");}
    }
    private List<Map<String,Object>> rows(String sql,Map<String,Object> p) {
        List<Map<String,Object>> rows=db.queryForList(sql,p);
        for(Map<String,Object> row:rows) for(String key:new ArrayList<>(row.keySet())) {
            Object value=row.get(key);
            if(value!=null && value.getClass().getName().equals("org.postgresql.util.PGobject")) {
                String text=value.toString();
                if(text.startsWith("{")||text.startsWith("["))row.put(key,parse(value));else row.put(key,text);
            }
            else if(value instanceof java.sql.Array array) {
                try { row.put(key,array.getArray()); } catch(java.sql.SQLException exception) {throw new IllegalArgumentException("Array inválido");}
            }
            else if(value instanceof java.sql.Timestamp timestamp)row.put(key,timestamp.toInstant().toString());
        }
        return rows;
    }
    private Map<String,Object> one(String sql,Map<String,Object> p) {
        List<Map<String,Object>> result=rows(sql,p);if(result.isEmpty())throw new NotFoundException("Recurso no disponible");return result.get(0);
    }
    private UUID uuid(Object value) { return value==null?null:UUID.fromString(value.toString()); }
    private Map<String,Object> with(Map<String,Object> p,String key,Object value) {p.put(key,value);return p;}
    private boolean clinicalCategory(Object category) {
        if(category==null)return false;
        String normalized=Normalizer.normalize(category.toString(),Normalizer.Form.NFD).replaceAll("\\p{M}","").trim().toUpperCase(Locale.ROOT);
        return Set.of("CLINICO","CLINICA","CLINICAL").contains(normalized);
    }
    private void requireClinicalFeature(Object category,Map<String,Object> p) {
        if(!clinicalCategory(category))return;
        if(!clinicalTenant(p))throw new AccessDeniedException("El tenant no tiene habilitado ni configurado el módulo clínico");
    }
    private boolean clinicalTenant(Map<String,Object> p) {
        Boolean enabled=db.queryForObject("""
            SELECT coalesce(pf.is_enabled,false) AND (
              EXISTS(SELECT 1 FROM document_categories dc WHERE dc.tenant_id=t.id AND upper(dc.code) IN ('CLINICAL','CLINICO','CLINICA'))
              OR EXISTS(SELECT 1 FROM expedient_types et WHERE et.tenant_id=t.id AND upper(et.code) IN ('CLINICAL','CLINICO','CLINICA')))
            FROM tenants t LEFT JOIN plan_features pf ON pf.plan_id=t.plan_id AND pf.feature_key='clinical_module'
            WHERE t.id=:tenant
            """,p,Boolean.class);
        return Boolean.TRUE.equals(enabled);
    }
    private void requireClinicalOrigin(Start request,Map<String,Object> p) {
        if(request.documentId()==null&&request.expedientId()==null)throw new IllegalArgumentException("Un workflow clínico requiere un documento o expediente clínico");
        if(request.documentId()!=null) {
            p.put("clinicalDocument",request.documentId());
            Boolean valid=db.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM documents d JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
                  LEFT JOIN document_categories dc ON dc.tenant_id=dt.tenant_id AND dc.id=dt.category_id
                  WHERE d.tenant_id=:tenant AND d.id=:clinicalDocument
                    AND (upper(coalesce(dc.code,''))='CLINICAL' OR upper(dt.code) LIKE 'CLINICAL%')
                """,p,Boolean.class);
            if(!Boolean.TRUE.equals(valid))throw new IllegalArgumentException("El documento seleccionado no pertenece a una categoría clínica");
        } else {
            p.put("clinicalExpedient",request.expedientId());
            Boolean valid=db.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM expedients e JOIN expedient_types et ON et.tenant_id=e.tenant_id AND et.id=e.expedient_type_id
                  WHERE e.tenant_id=:tenant AND e.id=:clinicalExpedient AND upper(et.code)='CLINICAL')
                """,p,Boolean.class);
            if(!Boolean.TRUE.equals(valid))throw new IllegalArgumentException("El expediente seleccionado no es clínico");
        }
    }
    public Map<String,Object> options() {
        permit("workflow:read");Map<String,Object> p=scope();
        return Map.of("users",rows("""
            SELECT u.id,trim(u.first_name||' '||u.last_name) AS name,u.department_id,
              coalesce(d.name,'') AS department,coalesce(max(r.approval_rank),0) AS approval_rank,
              coalesce(bool_or(r.workflow_owner),false) AS owner,
              array_agg(DISTINCT pe.code) FILTER(WHERE pe.code IS NOT NULL) AS permissions,
              string_agg(DISTINCT r.name,' · ' ORDER BY r.name) AS role_names
            FROM users u LEFT JOIN tenant_departments d ON d.id=u.department_id AND d.tenant_id=u.tenant_id
            LEFT JOIN user_roles ur ON ur.user_id=u.id AND ur.tenant_id=u.tenant_id
            LEFT JOIN roles r ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id AND r.is_active
            LEFT JOIN role_permissions rp ON rp.role_id=r.id AND rp.tenant_id=r.tenant_id
            LEFT JOIN permissions pe ON pe.id=rp.permission_id AND pe.is_active
            WHERE u.tenant_id=:tenant AND u.deleted_at IS NULL AND u.status::text='ACTIVE'
            GROUP BY u.id,u.first_name,u.last_name,u.department_id,d.name ORDER BY name
            """,p),"departments",rows("SELECT id,name FROM tenant_departments WHERE tenant_id=:tenant ORDER BY name",p),
            "roles",rows("SELECT id,name,approval_rank,workflow_owner FROM roles WHERE tenant_id=:tenant AND is_active ORDER BY approval_rank DESC,name",p));
    }
    private static final String FLOW_SELECT="""
        SELECT w.*, t.name AS template_name,t.version AS template_version,
          trim(u.first_name||' '||u.last_name) AS creator_name,s.name AS stage_name,s.stage_type,
          doc.document_id,doc.document_name,doc.document_code,e.name AS expedient_name,
          coalesce(stats.total_steps,0) AS total_steps,coalesce(done.completed_steps,0) AS completed_steps,
          CASE WHEN coalesce(stats.total_steps,0)=0 THEN 0 ELSE least(100,100*coalesce(done.completed_steps,0)/stats.total_steps) END AS progress,
          active.assigned_user_id AS responsible_id,active.responsible_name,
          coalesce(dept.name,'') AS department_name,
          final_approval.final_approver_name,
          CASE WHEN w.started_at IS NOT NULL AND w.completed_at IS NOT NULL
            THEN extract(epoch FROM (w.completed_at-w.started_at))/3600.0 END AS duration_hours
        FROM workflows w JOIN workflow_templates t ON t.id=w.workflow_template_id AND t.tenant_id=w.tenant_id
        JOIN users u ON u.id=w.creator_id AND u.tenant_id=w.tenant_id
        LEFT JOIN workflow_template_stages s ON s.id=w.current_stage_id AND s.tenant_id=w.tenant_id
        LEFT JOIN expedients e ON e.id=w.expedient_id AND e.tenant_id=w.tenant_id
        LEFT JOIN tenant_departments dept ON dept.id=w.department_id AND dept.tenant_id=w.tenant_id
        LEFT JOIN LATERAL (SELECT d.id AS document_id,d.name AS document_name,d.code AS document_code
          FROM workflow_documents wd JOIN documents d ON d.id=wd.document_id AND d.tenant_id=wd.tenant_id
          WHERE wd.workflow_id=w.id AND wd.tenant_id=w.tenant_id ORDER BY wd.added_at LIMIT 1) doc ON true
        LEFT JOIN LATERAL (SELECT count(*) AS total_steps FROM workflow_template_stages st
          WHERE st.workflow_template_id=w.workflow_template_id AND st.tenant_id=w.tenant_id
          AND st.stage_type IN ('TASK','REVIEW','APPROVAL')) stats ON true
        LEFT JOIN LATERAL (SELECT count(DISTINCT task.stage_id) AS completed_steps FROM workflow_tasks task
          WHERE task.workflow_id=w.id AND task.tenant_id=w.tenant_id AND task.status='COMPLETED' AND NOT task.correction) done ON true
        LEFT JOIN LATERAL (SELECT task.assigned_user_id,trim(person.first_name||' '||person.last_name) AS responsible_name
          FROM workflow_tasks task LEFT JOIN users person ON person.id=task.assigned_user_id AND person.tenant_id=task.tenant_id
          WHERE task.workflow_id=w.id AND task.tenant_id=w.tenant_id AND task.status IN ('PENDING','IN_PROGRESS','OVERDUE')
          ORDER BY task.created_at DESC LIMIT 1) active ON true
        LEFT JOIN LATERAL (SELECT trim(approver.first_name||' '||approver.last_name) AS final_approver_name
          FROM workflow_tasks task
          JOIN workflow_template_stages approval_stage ON approval_stage.id=task.stage_id AND approval_stage.tenant_id=task.tenant_id
          LEFT JOIN users approver ON approver.id=task.completed_by AND approver.tenant_id=task.tenant_id
          WHERE task.workflow_id=w.id AND task.tenant_id=w.tenant_id AND approval_stage.stage_type='APPROVAL'
            AND task.status='COMPLETED' AND task.outcome='APPROVED'
          ORDER BY task.completed_at DESC NULLS LAST LIMIT 1) final_approval ON true
        """;
    public Map<String,Object> list(Map<String,String> filters) {
        permit("workflow:read");Map<String,Object> p=scope();StringBuilder where=new StringBuilder(" WHERE w.tenant_id=:tenant AND w.deleted_at IS NULL");
        addFilter(filters,p,where,"status","w.status::text");addFilter(filters,p,where,"category","w.category");
        addFilter(filters,p,where,"responsibleId","active.assigned_user_id::text");
        addFilter(filters,p,where,"assignedUser","active.assigned_user_id::text");
        addFilter(filters,p,where,"departmentId","w.department_id::text");addFilter(filters,p,where,"area","w.department_id::text");
        addFilter(filters,p,where,"documentId","doc.document_id::text");addFilter(filters,p,where,"expedientId","w.expedient_id::text");
        addFilter(filters,p,where,"priority","w.priority::text");addFilter(filters,p,where,"templateId","w.workflow_template_id::text");
        addFilter(filters,p,where,"type","t.origin_type");
        String bucket=filters.getOrDefault("bucket","");
        where.append(switch(bucket){
            case "active"->" AND w.status IN ('STARTED','IN_PROGRESS')";
            case "operational"->" AND w.status IN ('DRAFT','STARTED','IN_PROGRESS','PAUSED')";
            case "review"->" AND w.status IN ('STARTED','IN_PROGRESS') AND s.stage_type='REVIEW'";
            case "pending"->" AND w.status IN ('STARTED','IN_PROGRESS') AND s.stage_type IN ('TASK','APPROVAL')";
            case "completed"->" AND w.status='COMPLETED'";
            case "draft"->" AND w.status='DRAFT'";default->"";});
        String search=filters.getOrDefault("search","").trim();p.put("search","%"+search+"%");
        if(!search.isEmpty())where.append(" AND concat_ws(' ',w.title,w.code,doc.document_name,doc.document_code,e.name,active.responsible_name,t.name,w.category) ILIKE :search");
        for(String key:List.of("createdFrom","createdTo","startedFrom","startedTo","completedFrom","completedTo","dateFrom","dateTo","dueFrom","dueTo"))if(filters.get(key)!=null&&!filters.get(key).isBlank()) {
            p.put(key,filters.get(key));where.append(" AND ").append(key.startsWith("due")?"w.due_at":key.startsWith("completed")?"w.completed_at":key.startsWith("started")?"w.started_at":"w.created_at")
              .append(key.endsWith("From")?">=CAST(:":"<CAST(:").append(key).append(key.endsWith("From")?" AS date)":" AS date)+interval '1 day'");
        }
        if("REVIEW".equals(filters.get("stageType")) || "APPROVAL".equals(filters.get("stageType"))) {
            p.put("stageType",filters.get("stageType"));where.append(" AND s.stage_type=:stageType AND w.status IN ('STARTED','IN_PROGRESS')");
        }
        String sort=switch(filters.getOrDefault("sort","created_at")) {
            case "title"->"w.title";case "due_at"->"w.due_at";case "completed_at"->"w.completed_at";case "status"->"w.status";case "priority"->"w.priority";case "progress"->"progress";default->"w.created_at";};
        return page(FLOW_SELECT,where.toString(),p,filters,sort);
    }
    private void addFilter(Map<String,String> f,Map<String,Object> p,StringBuilder where,String key,String sql) {
        String value=f.get(key);if(value!=null&&!value.isBlank()){p.put(key,value);where.append(" AND ").append(sql).append("=:").append(key);}
    }
    private Map<String,Object> page(String select,String where,Map<String,Object> p,Map<String,String> f,String sort) {
        int size=Math.min(100,Math.max(1,Integer.parseInt(f.getOrDefault("size","10"))));
        int number=Math.max(0,Integer.parseInt(f.getOrDefault("page","0")));
        long total=db.queryForObject("SELECT count(*) FROM ("+select+where+") results",p,Long.class);
        p.put("limit",size);p.put("offset",(long)number*size);
        List<Map<String,Object>> content=rows(select+where+" ORDER BY "+sort+("asc".equals(f.get("direction"))?" ASC":" DESC")+" NULLS LAST,id LIMIT :limit OFFSET :offset",p);
        int totalPages=(int)((total+size-1)/size);
        return Map.of("content",content,"totalElements",total,"number",number,"size",size,
            "totalPages",totalPages,"first",number==0,"last",number>=Math.max(0,totalPages-1));
    }
    public Map<String,Object> detail(UUID id) {
        permit("workflow:read");Map<String,Object> p=with(scope(),"id",id);
        Map<String,Object> flow=one(FLOW_SELECT+" WHERE w.tenant_id=:tenant AND w.id=:id AND w.deleted_at IS NULL",p);
        flow.put("stages",rows("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND workflow_template_id=:template ORDER BY sort_order",with(p,"template",flow.get("workflow_template_id"))));
        flow.put("tasks",rows(TASK_SELECT+" WHERE q.tenant_id=:tenant AND q.workflow_id=:id ORDER BY q.created_at",p));
        flow.put("stepInstances",rows("SELECT * FROM workflow_steps WHERE tenant_id=:tenant AND workflow_id=:id ORDER BY created_at,id",p));
        flow.put("approvals",rows("SELECT a.*,trim(u.first_name||' '||u.last_name) AS approver_name FROM workflow_approvals a JOIN users u ON u.id=a.approver_user_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=:tenant AND a.workflow_id=:id ORDER BY a.decided_at,a.id",p));
        flow.put("events",rows("SELECT ev.*,trim(u.first_name||' '||u.last_name) AS actor_name FROM workflow_events ev LEFT JOIN users u ON u.id=ev.performed_by AND u.tenant_id=ev.tenant_id WHERE ev.tenant_id=:tenant AND ev.workflow_id=:id ORDER BY ev.performed_at,ev.id",p));
        flow.put("comments",rows("SELECT c.id,c.task_id,c.document_id,c.comment_text,c.created_at,c.author_id,trim(u.first_name||' '||u.last_name) AS author_name FROM workflow_comments c JOIN users u ON u.id=c.author_id AND u.tenant_id=c.tenant_id WHERE c.tenant_id=:tenant AND c.workflow_id=:id AND c.deleted_at IS NULL ORDER BY c.created_at,c.id",p));
        flow.put("participants",rows("""
            WITH participants AS (
              SELECT w.creator_id AS user_id,'Solicitante' AS participant_role FROM workflows w WHERE w.tenant_id=:tenant AND w.id=:id
              UNION ALL
              SELECT q.assigned_user_id,CASE s.stage_type WHEN 'REVIEW' THEN 'Revisor' WHEN 'APPROVAL' THEN 'Aprobador' ELSE 'Responsable' END
              FROM workflow_tasks q LEFT JOIN workflow_template_stages s ON s.tenant_id=q.tenant_id AND s.id=q.stage_id
              WHERE q.tenant_id=:tenant AND q.workflow_id=:id AND q.assigned_user_id IS NOT NULL
              UNION ALL
              SELECT assignment.value::uuid,'Responsable' FROM workflows w
              CROSS JOIN LATERAL jsonb_each_text(w.assignments) assignment
              WHERE w.tenant_id=:tenant AND w.id=:id
              UNION ALL
              SELECT ev.performed_by,'Participante' FROM workflow_events ev WHERE ev.tenant_id=:tenant AND ev.workflow_id=:id AND ev.performed_by IS NOT NULL
              UNION ALL
              SELECT c.author_id,'Participante' FROM workflow_comments c WHERE c.tenant_id=:tenant AND c.workflow_id=:id AND c.deleted_at IS NULL
            )
            SELECT u.id,trim(u.first_name||' '||u.last_name) AS name,coalesce(d.name,'') AS department_name,
              string_agg(DISTINCT participants.participant_role,' · ' ORDER BY participants.participant_role) AS roles
            FROM participants JOIN users u ON u.tenant_id=:tenant AND u.id=participants.user_id
            LEFT JOIN tenant_departments d ON d.tenant_id=u.tenant_id AND d.id=u.department_id
            GROUP BY u.id,u.first_name,u.last_name,d.name ORDER BY name
            """,p));
        return flow;
    }
    public Map<String,Object> history(UUID id) {
        permit("workflow:read");Map<String,Object> p=with(scope(),"id",id);
        one("SELECT id FROM workflows WHERE tenant_id=:tenant AND id=:id AND deleted_at IS NULL",p);
        return Map.of("content",rows("SELECT ev.*,trim(u.first_name||' '||u.last_name) AS actor_name FROM workflow_events ev LEFT JOIN users u ON u.id=ev.performed_by AND u.tenant_id=ev.tenant_id WHERE ev.tenant_id=:tenant AND ev.workflow_id=:id ORDER BY ev.performed_at,ev.id",p));
    }
    public Map<String,Object> workflowTasks(UUID id,Map<String,String> filters) {
        permit("workflow:read");Map<String,Object> p=with(scope(),"id",id);
        one("SELECT id FROM workflows WHERE tenant_id=:tenant AND id=:id AND deleted_at IS NULL",p);
        StringBuilder where=new StringBuilder(" WHERE q.tenant_id=:tenant AND q.workflow_id=:id");
        addFilter(filters,p,where,"status","q.status::text");addFilter(filters,p,where,"priority","q.priority::text");
        return page(TASK_SELECT,where.toString(),p,filters,"q.due_at");
    }
    public Map<String,Object> myApprovals(Map<String,String> filters) {
        permit("workflow:read");Map<String,Object> p=scope();String where=" WHERE a.tenant_id=:tenant AND a.approver_user_id=:actor";
        return page("SELECT a.*,w.code AS workflow_code,w.title AS workflow_title,s.name AS stage_name,trim(u.first_name||' '||u.last_name) AS requester_name FROM workflow_approvals a JOIN workflows w ON w.id=a.workflow_id AND w.tenant_id=a.tenant_id LEFT JOIN workflow_steps s ON s.id=a.step_id AND s.tenant_id=a.tenant_id JOIN users u ON u.id=w.creator_id AND u.tenant_id=w.tenant_id",where,p,filters,"a.decided_at");
    }
    public Map<String,Object> templates(Map<String,String> f) {
        permit("workflow_template:read");Map<String,Object> p=scope();p.put("search","%"+f.getOrDefault("search","")+"%");
        p.put("clinicalEnabled",clinicalTenant(p));
        StringBuilder where=new StringBuilder(" WHERE t.tenant_id=:tenant AND t.name ILIKE :search AND (lower(t.category) NOT IN ('clínico','clinico','clínica','clinica','clinical') OR :clinicalEnabled)");
        addFilter(f,p,where,"category","t.category");addFilter(f,p,where,"familyId","t.family_id::text");
        String sort=switch(f.getOrDefault("sort","created_at")) {case "title"->"t.name";case "updated_at"->"t.updated_at";default->"t.created_at";};
        return page("""
            SELECT t.*,
              (SELECT count(*) FROM workflow_template_stages s WHERE s.tenant_id=t.tenant_id AND s.workflow_template_id=t.id) AS steps,
              (SELECT count(DISTINCT concat_ws(':',s.assignment_type,s.assignment_reference)) FROM workflow_template_stages s WHERE s.tenant_id=t.tenant_id AND s.workflow_template_id=t.id AND s.assignment_type IS NOT NULL) AS roles,
              (SELECT coalesce(sum(s.due_days),0) FROM workflow_template_stages s WHERE s.tenant_id=t.tenant_id AND s.workflow_template_id=t.id) AS estimated_days
            FROM workflow_templates t
            """,where.toString(),p,f,sort);
    }
    public Map<String,Object> template(UUID id) {
        permit("workflow_template:read");Map<String,Object> p=with(scope(),"id",id);
        Map<String,Object> template=one("SELECT * FROM workflow_templates WHERE tenant_id=:tenant AND id=:id",p);
        requireClinicalFeature(template.get("category"),p);
        template.put("nodes",rows("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND workflow_template_id=:id ORDER BY sort_order",p));
        @SuppressWarnings("unchecked") List<Map<String,Object>> nodes=(List<Map<String,Object>>)template.get("nodes");
        for(Map<String,Object> node:nodes)if("ROLE".equals(node.get("assignment_type"))&&node.get("assignment_reference")!=null) {
            p.put("legacyRef",node.get("assignment_reference"));
            List<Map<String,Object>> role=rows("SELECT id FROM roles WHERE tenant_id=:tenant AND is_active AND (id::text=:legacyRef OR name=:legacyRef)",p);
            if(!role.isEmpty())node.put("assignment_reference",role.get(0).get("id").toString());
        }
        template.put("edges",rows("SELECT * FROM workflow_template_transitions WHERE tenant_id=:tenant AND workflow_template_id=:id",p));return template;
    }
    public Map<String,Object> validateTemplate(Template request) {permit("workflow:designer");Map<String,Object> p=scope();requireClinicalFeature(request.category(),p);WorkflowGraphValidator.validate(request);return Map.of("valid",true);}
    public Map<String,Object> seedStarterTemplates() {
        permit("workflow_template:create");permit("workflow:designer");
        Map<String,Object> p=scope();List<String> created=new ArrayList<>();
        List<Template> starters=List.of(
            starter("Aprobación simple","Flujo base con una etapa de aprobación.","Administrativo",List.of("START","APPROVAL","END")),
            starter("Revisión documental","Revisión de integridad y legibilidad documental.","Documental",List.of("START","REVIEW","END")),
            starter("Revisión y aprobación","Revisión documental seguida de aprobación formal.","Documental",List.of("START","REVIEW","APPROVAL","END")),
            decisionStarter(),
            contractStarter()
        );
        List<Template> available=new ArrayList<>(starters);
        if(clinicalTenant(p))available.add(clinicalStarter());
        for(Template starter:available) {
            p.put("starterName",starter.name());p.put("starterCategory",starter.category());
            Integer count=db.queryForObject("SELECT count(*) FROM workflow_templates WHERE tenant_id=:tenant AND name=:starterName AND category=:starterCategory",p,Integer.class);
            if(count==null||count==0){saveTemplate(null,starter);created.add(starter.name());}
        }
        return Map.of("created",created,"count",created.size());
    }
    private Template starter(String name,String description,String category,List<String> types) {
        List<Node> nodes=new ArrayList<>();List<Edge> edges=new ArrayList<>();
        for(int i=0;i<types.size();i++) {
            String type=types.get(i),key="step-"+i;
            nodes.add(new Node(key,switch(type){case "START"->"Inicio";case "REVIEW"->"Revisión";case "APPROVAL"->"Aprobación";default->"Fin";},type,null,null,2,Map.of()));
            if(i>0)edges.add(new Edge("step-"+(i-1),key,"DEFAULT",""));
        }
        return new Template(name,description,category,"ANY",true,nodes,edges,Map.of(
            "ON_START","UNCHANGED","ON_REVIEW","IN_REVIEW","ON_APPROVE","APPROVED",
            "ON_REJECT","REJECTED","ON_RETURN","DRAFT","ON_ARCHIVE","ARCHIVED","ON_COMPLETE","CURRENT"));
    }
    private Node seedNode(String key,String name,String type) {
        Map<String,Object> rules=new HashMap<>();
        if(type.equals("REVIEW")||type.equals("APPROVAL")){rules.put("allowReturn",true);rules.put("allowReject",type.equals("APPROVAL"));}
        return new Node(key,name,type,null,null,2,rules);
    }
    private Template graphStarter(String name,String description,String category,String origin,List<Node> nodes,List<Edge> edges) {
        return new Template(name,description,category,origin,true,nodes,edges,Map.of(
            "ON_START","UNCHANGED","ON_REVIEW","IN_REVIEW","ON_APPROVE","APPROVED",
            "ON_REJECT","REJECTED","ON_RETURN","DRAFT","ON_ARCHIVE","ARCHIVED","ON_COMPLETE","CURRENT"));
    }
    private Template decisionStarter() {
        Node review=seedNode("review","Revisión inicial","REVIEW");Map<String,Object> reviewRules=new HashMap<>(review.rules());reviewRules.put("allowReject",true);
        review=new Node(review.key(),review.name(),review.type(),review.assignmentType(),review.assignmentReference(),review.dueDays(),reviewRules);
        List<Node> nodes=List.of(seedNode("start","Inicio","START"),seedNode("create","Crear documento","TASK"),
            review,seedNode("decision","¿Documento correcto?","DECISION"),
            seedNode("correction","Corregir documento","TASK"),seedNode("review-after-correction","Revisión posterior","REVIEW"),
            seedNode("approval","Aprobación","APPROVAL"),seedNode("notify","Notificación","NOTIFICATION"),seedNode("end","Fin","END"));
        List<Edge> edges=List.of(new Edge("start","create","DEFAULT",""),new Edge("create","review","DEFAULT",""),
            new Edge("review","decision","DEFAULT",""),new Edge("review","decision","REJECTED","Observaciones"),new Edge("decision","approval","YES","Sí"),
            new Edge("decision","correction","NO","No"),new Edge("correction","review-after-correction","DEFAULT",""),
            new Edge("review-after-correction","approval","DEFAULT",""),new Edge("approval","notify","DEFAULT",""),
            new Edge("notify","end","DEFAULT",""));
        return graphStarter("Revisión documental con decisión","Revisión con ruta de corrección y aprobación según resultado.","Documental","DOCUMENT",nodes,edges);
    }
    private Template contractStarter() {
        Node legal=seedNode("legal","Revisión Legal","REVIEW");Map<String,Object> legalRules=new HashMap<>(legal.rules());legalRules.put("allowReject",true);
        legal=new Node(legal.key(),legal.name(),legal.type(),legal.assignmentType(),legal.assignmentReference(),legal.dueDays(),legalRules);
        List<Node> nodes=List.of(seedNode("start","Inicio","START"),seedNode("hr","Revisión de Recursos Humanos","REVIEW"),
            legal,seedNode("decision","¿Contrato conforme?","DECISION"),seedNode("correction","Corregir contrato","TASK"),seedNode("legal-recheck","Revisión legal posterior","REVIEW"),
            seedNode("direction","Aprobación de Dirección","APPROVAL"),seedNode("notify","Notificar resultado","NOTIFICATION"),seedNode("end","Fin","END"));
        List<Edge> edges=List.of(new Edge("start","hr","DEFAULT",""),new Edge("hr","legal","DEFAULT",""),
            new Edge("legal","decision","DEFAULT",""),new Edge("legal","decision","REJECTED","Observaciones"),
            new Edge("decision","direction","YES","Sí"),new Edge("decision","correction","NO","No"),
            new Edge("correction","legal-recheck","DEFAULT","Revisión posterior"),new Edge("legal-recheck","direction","DEFAULT",""),new Edge("direction","notify","DEFAULT",""),
            new Edge("notify","end","DEFAULT",""));
        return graphStarter("Aprobación de contrato de personal","Revisión administrativa y legal, corrección con nueva revisión, aprobación de Dirección y notificación.","Legal","DOCUMENT",nodes,edges);
    }
    private Template clinicalStarter() {
        Node review=seedNode("review","Revisión médica","REVIEW");Map<String,Object> reviewRules=new HashMap<>(review.rules());reviewRules.put("allowReject",true);
        review=new Node(review.key(),review.name(),review.type(),review.assignmentType(),review.assignmentReference(),review.dueDays(),reviewRules);
        List<Node> nodes=List.of(seedNode("start","Inicio","START"),review,
            seedNode("decision","¿Información completa?","DECISION"),seedNode("correction","Completar informe médico","TASK"),seedNode("review-again","Validación posterior a la corrección","REVIEW"),
            seedNode("approval","Firma y aprobación médica","APPROVAL"),seedNode("archive","Incorporar al expediente","ARCHIVE"),
            seedNode("end","Fin","END"));
        List<Edge> edges=List.of(new Edge("start","review","DEFAULT",""),new Edge("review","decision","DEFAULT",""),new Edge("review","decision","REJECTED","Observaciones"),
            new Edge("decision","approval","YES","Sí"),new Edge("decision","correction","NO","No"),
            new Edge("correction","review-again","DEFAULT",""),new Edge("review-again","approval","DEFAULT",""),new Edge("approval","archive","DEFAULT",""),
            new Edge("archive","end","DEFAULT",""));
        return graphStarter("Informe médico de alta","Revisión clínica, corrección cuando haga falta, aprobación e incorporación al expediente.","Clínico","DOCUMENT",nodes,edges);
    }
    public Map<String,Object> saveTemplate(UUID oldId,Template request) {
        permit(oldId==null?"workflow_template:create":"workflow_template:update");permit("workflow:designer");
        WorkflowGraphValidator.validate(request);Map<String,Object> p=scope();requireClinicalFeature(request.category(),p);UUID id=UUID.randomUUID(),family=id;int version=1;
        if(oldId!=null) {
            Map<String,Object> old=one("SELECT * FROM workflow_templates WHERE tenant_id=:tenant AND id=:old FOR UPDATE",with(p,"old",oldId));
            family=uuid(old.get("family_id"));p.put("family",family);
            // Serialise all versions of the family, including unused versions.
            db.queryForList("SELECT id FROM workflow_templates WHERE tenant_id=:tenant AND family_id=:family FOR UPDATE",p);
            version=db.queryForObject("SELECT coalesce(max(version),0)+1 FROM workflow_templates WHERE tenant_id=:tenant AND family_id=:family",p,Integer.class);
        }
        String publication=Objects.toString(request.publicationStatus(),request.active()?"ACTIVE":"INACTIVE").toUpperCase(Locale.ROOT);
        if(!Set.of("DRAFT","ACTIVE","INACTIVE").contains(publication))throw new IllegalArgumentException("Estado de publicación inválido");
        boolean active=publication.equals("ACTIVE");
        p.put("id",id);p.put("family",family);p.put("version",version);p.put("name",request.name());p.put("description",request.description());
        p.put("category",request.category());p.put("origin",request.originType());p.put("active",active);p.put("publication",publication);
        p.put("statusRules",json(validatedDocumentStatusRules(request.documentStatusRules())));
        if(!Set.of("ANY","DOCUMENT","EXPEDIENT","INDEPENDENT").contains(request.originType()))throw new IllegalArgumentException("Origen inválido");
        if(oldId!=null)db.update("UPDATE workflow_templates SET is_active=false,publication_status='INACTIVE' WHERE tenant_id=:tenant AND family_id=:family AND is_active",p);
        db.update("INSERT INTO workflow_templates(id,tenant_id,name,description,category,origin_type,version,is_active,publication_status,created_by,family_id,document_status_rules) VALUES(:id,:tenant,:name,:description,:category,:origin,:version,:active,:publication,:actor,:family,CAST(:statusRules AS jsonb))",p);
        Map<String,UUID> keys=new HashMap<>();int order=0;
        for(Node node:request.nodes()) {
            UUID nodeId=UUID.randomUUID();keys.put(node.key(),nodeId);Map<String,Object> n=new HashMap<>(p);
            Map<String,Object> rules=new HashMap<>(node.rules()==null?Map.of():node.rules());rules.put("key",node.key());
            n.put("node",nodeId);n.put("name",node.name());n.put("type",node.type());n.put("order",order++);
            n.put("assignmentType",node.assignmentType());n.put("reference",node.assignmentReference());n.put("days",node.dueDays());n.put("rules",json(rules));
            validateAssignment(node,p);
            db.update("INSERT INTO workflow_template_stages(id,tenant_id,workflow_template_id,name,stage_type,sort_order,assignment_type,assignment_reference,due_days,rules) VALUES(:node,:tenant,:id,:name,:type,:order,:assignmentType,:reference,:days,CAST(:rules AS jsonb))",n);
        }
        for(Edge edge:request.edges()) {
            Map<String,Object> e=new HashMap<>(p);e.put("from",keys.get(edge.from()));e.put("to",keys.get(edge.to()));
            e.put("label",edge.label());e.put("condition",json(Map.of("outcome",edge.outcome()==null?"DEFAULT":edge.outcome())));
            db.update("INSERT INTO workflow_template_transitions(tenant_id,workflow_template_id,from_stage_id,to_stage_id,name,condition) VALUES(:tenant,:id,:from,:to,:label,CAST(:condition AS jsonb))",e);
        }
        auditTemplate(id,oldId==null?"WORKFLOW_TEMPLATE_CREATED":"WORKFLOW_TEMPLATE_UPDATED",oldId);
        return template(id);
    }
    private void auditTemplate(UUID id,String action,UUID previousVersion) {
        Map<String,Object> p=scope();p.put("action",action);p.put("entity",id);p.put("metadata",json(Map.of("templateId",id,"previousTemplateVersionId",Objects.toString(previousVersion,""))));
        db.queryForList("SELECT app.record_workflow_audit(:action,:entity,NULL,NULL,NULL,NULL,NULL,NULL,CAST(:metadata AS jsonb))",p);
    }
    private void validateAssignment(Node node,Map<String,Object> p) {
        if(node.assignmentType()==null || node.assignmentType().isBlank())return; // wizard supplies override
        if(!Set.of("USER","ROLE","DEPARTMENT","GROUP").contains(node.assignmentType()))throw new IllegalArgumentException("Asignación inválida");
        if(node.assignmentReference()==null||node.assignmentReference().isBlank())throw new IllegalArgumentException("Falta referencia de asignación");
        String table=switch(node.assignmentType()){case "USER"->"users";case "ROLE"->"roles";case "DEPARTMENT"->"tenant_departments";default->"user_groups";};
        p.put("reference",node.assignmentReference());
        one("SELECT id FROM "+table+" WHERE tenant_id=:tenant AND id::text=:reference",p);
    }
    public void deactivate(UUID id) {
        permit("workflow_template:delete");Map<String,Object> p=with(scope(),"id",id);
        one("SELECT id FROM workflow_templates WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);
        db.update("UPDATE workflow_templates SET is_active=false,publication_status='INACTIVE' WHERE tenant_id=:tenant AND id=:id",p);
        auditTemplate(id,"WORKFLOW_TEMPLATE_UPDATED",id);
    }
    public Map<String,Object> start(Start request) {
        permit("workflow:start");permit("workflow:create");Map<String,Object> p=scope();p.put("template",request.templateId());p.put("previousStatus","DRAFT");
        Map<String,Object> template=one("SELECT * FROM workflow_templates WHERE tenant_id=:tenant AND id=:template AND is_active FOR SHARE",p);
        requireClinicalFeature(template.get("category"),p);
        String origin=template.get("origin_type").toString();
        if(origin.equals("DOCUMENT")&&request.documentId()==null || origin.equals("EXPEDIENT")&&request.expedientId()==null
                || origin.equals("INDEPENDENT")&&(request.documentId()!=null||request.expedientId()!=null))throw new IllegalArgumentException("El origen no coincide con la plantilla");
        if(request.dueAt()!=null&&request.dueAt().isBefore(OffsetDateTime.now()))throw new IllegalArgumentException("El vencimiento debe ser futuro");
        p.put("document",request.documentId());p.put("expedient",request.expedientId());p.put("department",request.departmentId());
        if(request.documentId()!=null) {
            Map<String,Object> doc=one("SELECT * FROM documents WHERE tenant_id=:tenant AND id=:document AND deleted_at IS NULL FOR UPDATE",p);
            if(Set.of("ARCHIVED","VOIDED","TRASHED").contains(doc.get("status").toString()))throw new IllegalArgumentException("Documento no disponible para workflow");
            if(doc.get("current_version")==null)throw new IllegalArgumentException("Sube el archivo del documento antes de iniciar el workflow");
            if(request.expedientId()!=null&&!request.expedientId().equals(uuid(doc.get("expedient_id"))))throw new IllegalArgumentException("El documento pertenece a otro expediente");
            Long count=db.queryForObject("SELECT count(*) FROM workflow_documents wd JOIN workflows w ON w.id=wd.workflow_id AND w.tenant_id=wd.tenant_id WHERE wd.tenant_id=:tenant AND wd.document_id=:document AND w.status IN ('STARTED','IN_PROGRESS','PAUSED') AND w.deleted_at IS NULL",p,Long.class);
            if(count>0)conflict("El documento ya tiene un workflow activo");
        }
        if(request.expedientId()!=null)one("SELECT id FROM expedients WHERE tenant_id=:tenant AND id=:expedient AND deleted_at IS NULL",p);
        if(clinicalCategory(template.get("category")))requireClinicalOrigin(request,p);
        if(request.departmentId()!=null)one("SELECT id FROM tenant_departments WHERE tenant_id=:tenant AND id=:department",p);
        Map<String,UUID> assignments=request.assignments()==null?Map.of():request.assignments();
        for(UUID user:assignments.values())requireActiveUser(user,p);
        p.put("id",UUID.randomUUID());p.put("title",request.title());p.put("description",request.description());p.put("category",template.get("category"));
        p.put("priority",request.priority());p.put("due",request.dueAt());p.put("assignments",json(assignments));
        p.put("statusRules",json(template.get("document_status_rules")));
        Map<String,Object> sequence=one("INSERT INTO workflow_codes(tenant_id,next_number) VALUES(:tenant,2) ON CONFLICT(tenant_id) DO UPDATE SET next_number=workflow_codes.next_number+1 RETURNING next_number-1 AS number",p);
        p.put("code","WF-"+OffsetDateTime.now().getYear()+"-"+String.format("%06d",((Number)sequence.get("number")).longValue()));
        db.update("INSERT INTO workflows(id,tenant_id,workflow_template_id,expedient_id,department_id,title,description,status,priority,creator_id,started_at,due_at,code,category,assignments,document_status_rules) VALUES(:id,:tenant,:template,:expedient,:department,:title,:description,'IN_PROGRESS',:priority,:actor,now(),:due,:code,:category,CAST(:assignments AS jsonb),CAST(:statusRules AS jsonb))",p);
        if(request.documentId()!=null)db.update("INSERT INTO workflow_documents(tenant_id,workflow_id,document_id) VALUES(:tenant,:id,:document)",p);
        for(Map<String,Object> node:rows("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND workflow_template_id=:template AND stage_type IN ('TASK','REVIEW','APPROVAL')",p))resolveAssignee(p,node);
        UUID first=uuid(one("SELECT id FROM workflow_template_stages WHERE tenant_id=:tenant AND workflow_template_id=:template AND stage_type='START'",p).get("id"));
        event(p,null,"STARTED","IN_PROGRESS",null,Map.of("templateVersion",template.get("version")));
        documentStatusFor(p,"ON_START");
        notify(p,context.requireUserId(),"WORKFLOW_STARTED","Workflow iniciado",request.title());
        advance(p,first,"DEFAULT",0);
        return detail(uuid(p.get("id")));
    }
    public Map<String,Object> instantiate(UUID templateId,TemplateStart request) {
        return start(new Start(templateId,request.title(),request.description(),request.documentId(),request.expedientId(),
            request.departmentId(),request.priority(),request.dueAt(),request.assignments()));
    }
    private void requireActiveUser(UUID user,Map<String,Object> p) {
        p.put("user",user);one("SELECT id FROM users WHERE tenant_id=:tenant AND id=:user AND deleted_at IS NULL AND status::text='ACTIVE'",p);
    }
    private static final String TASK_SELECT="""
        SELECT q.*, w.title AS workflow_title,w.code AS workflow_code,w.status AS workflow_status,w.creator_id,
          w.expedient_id,w.category,w.department_id,s.name AS stage_name,s.stage_type,s.rules,
          d.name AS document_name,d.description AS document_description,d.current_version,
          d.author_id AS document_author_id,d.status AS document_status,
          e.name AS expedient_name,dt.name AS document_type,
          trim(u.first_name||' '||u.last_name) AS responsible_name,
          trim(creator.first_name||' '||creator.last_name) AS requester_name,
          coalesce(dept.name,'') AS department_name
        FROM workflow_tasks q JOIN workflows w ON w.id=q.workflow_id AND w.tenant_id=q.tenant_id
        LEFT JOIN workflow_template_stages s ON s.id=q.stage_id AND s.tenant_id=q.tenant_id
        LEFT JOIN documents d ON d.id=q.document_id AND d.tenant_id=q.tenant_id
        LEFT JOIN document_types dt ON dt.id=d.document_type_id AND dt.tenant_id=d.tenant_id
        LEFT JOIN expedients e ON e.id=w.expedient_id AND e.tenant_id=w.tenant_id
        LEFT JOIN users u ON u.id=q.assigned_user_id AND u.tenant_id=q.tenant_id
        LEFT JOIN users creator ON creator.id=w.creator_id AND creator.tenant_id=w.tenant_id
        LEFT JOIN tenant_departments dept ON dept.id=w.department_id AND dept.tenant_id=w.tenant_id
        """;
    private static final String MY_TASK="""
        (q.assigned_user_id=:actor OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.tenant_id=q.tenant_id AND ur.user_id=:actor AND ur.role_id=q.assigned_role_id))
        """;
    public Map<String,Object> tasks(Map<String,String> f) {
        permit("task:read");Map<String,Object> p=scope();StringBuilder where=new StringBuilder(" WHERE q.tenant_id=:tenant AND w.deleted_at IS NULL AND "+MY_TASK);
        if(f.get("status")!=null&&!f.get("status").isBlank())addFilter(f,p,where,"status","q.status::text");
        addFilter(f,p,where,"stageType","s.stage_type");addFilter(f,p,where,"type","s.stage_type");
        addFilter(f,p,where,"category","w.category");addFilter(f,p,where,"priority","q.priority::text");
        addFilter(f,p,where,"area","w.department_id::text");
        if(f.get("assignedUser")!=null&&!f.get("assignedUser").isBlank()) {
            UUID assignedFilter=UUID.fromString(f.get("assignedUser"));
            if(!assignedFilter.equals(context.requireUserId()))throw new AccessDeniedException("Solo puedes consultar tus tareas asignadas");
            p.put("assignedUser",assignedFilter);where.append(" AND q.assigned_user_id=:assignedUser");
        }
        if("true".equals(f.get("overdue")))where.append(" AND q.due_at<now() AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')");
        if("true".equals(f.get("dueSoon")))where.append(" AND q.due_at>=now() AND q.due_at<now()+interval '3 days' AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')");
        if("true".equals(f.get("today")))where.append(" AND q.due_at::date=current_date");
        if(f.get("stageType")!=null)where.append(" AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE') AND w.status IN ('STARTED','IN_PROGRESS')");
        for(String key:List.of("dateFrom","dateTo","dueFrom","dueTo"))if(f.get(key)!=null&&!f.get(key).isBlank()) {
            p.put(key,f.get(key));where.append(" AND ").append(key.startsWith("due")?"q.due_at":"q.created_at")
                .append(key.endsWith("From")?">=CAST(:":"<CAST(:").append(key).append(key.endsWith("From")?" AS date)":" AS date)+interval '1 day'");
        }
        p.put("search","%"+f.getOrDefault("search","")+"%");where.append(" AND concat_ws(' ',q.title,w.code,w.title,d.name) ILIKE :search");
        return page(TASK_SELECT,where.toString(),p,f,"q.due_at");
    }
    public Map<String,Object> task(UUID id) {
        permit("task:read");Map<String,Object> p=with(scope(),"task",id);
        Map<String,Object> task=one(TASK_SELECT+" WHERE q.tenant_id=:tenant AND q.id=:task",p);p.put("id",task.get("workflow_id"));
        if(!assigned(task,p) && !context.hasAuthority("workflow:assign"))throw new AccessDeniedException("Tarea no asignada al usuario");
        task.put("checklist_items",rows("SELECT id,label,required,completed,completed_by,completed_at FROM workflow_checklist_items WHERE tenant_id=:tenant AND task_id=:task ORDER BY created_at,id",p));
        task.put("approvals",rows("SELECT a.*,trim(u.first_name||' '||u.last_name) AS approver_name FROM workflow_approvals a JOIN users u ON u.id=a.approver_user_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=:tenant AND a.task_id=:task ORDER BY a.decided_at,a.id",p));
        task.put("comments",rows("SELECT c.*,trim(u.first_name||' '||u.last_name) AS author_name FROM workflow_comments c JOIN users u ON u.id=c.author_id AND u.tenant_id=c.tenant_id WHERE c.tenant_id=:tenant AND c.task_id=:task ORDER BY c.created_at,c.id",p));
        task.put("events",rows("SELECT ev.*,trim(u.first_name||' '||u.last_name) AS actor_name FROM workflow_events ev LEFT JOIN users u ON u.id=ev.performed_by AND u.tenant_id=ev.tenant_id WHERE ev.tenant_id=:tenant AND ev.workflow_id=:id ORDER BY ev.performed_at,ev.id",p));
        task.put("stages",rows("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND workflow_template_id=:template ORDER BY sort_order",with(p,"template",task.get("workflow_template_id"))));
        task.put("can_approve",assigned(task,p)&&context.hasAuthority("workflow:approve")&&canApprove(task,p));
        task.put("can_act",assigned(task,p));
        return task;
    }
    private boolean assigned(Map<String,Object> task,Map<String,Object> p) {
        if(context.requireUserId().equals(uuid(task.get("assigned_user_id"))))return true;
        if(task.get("assigned_role_id")==null)return false;
        p.put("role",task.get("assigned_role_id"));return db.queryForObject("SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id WHERE ur.tenant_id=:tenant AND ur.user_id=:actor AND ur.role_id=:role AND r.is_active",p,Long.class)>0;
    }
    private Map<String,Object> rank(UUID user,Map<String,Object> p) {
        p.put("rankUser",user);
        return one("SELECT coalesce(max(r.approval_rank),0) AS rank,coalesce(bool_or(r.workflow_owner),false) AS owner FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id WHERE ur.tenant_id=:tenant AND ur.user_id=:rankUser AND r.is_active",p);
    }
    private boolean canApprove(Map<String,Object> task,Map<String,Object> p) {
        Map<String,Object> actor=rank(context.requireUserId(),p);
        if(Boolean.TRUE.equals(actor.get("owner")))return true;
        for(String key:List.of("creator_id","document_author_id")) {
            UUID author=uuid(task.get(key));if(author==null)continue;
            if(author.equals(context.requireUserId()) || ((Number)actor.get("rank")).intValue()<=((Number)rank(author,p).get("rank")).intValue())return false;
        }
        return true;
    }
    public Map<String,Object> action(UUID id,Action request) {
        permit("task:update");Map<String,Object> p=with(scope(),"task",id);
        Map<String,Object> lookup=one("SELECT workflow_id FROM workflow_tasks WHERE tenant_id=:tenant AND id=:task",p);p.put("id",lookup.get("workflow_id"));
        Map<String,Object> flow=one("SELECT * FROM workflows WHERE tenant_id=:tenant AND id=:id AND deleted_at IS NULL FOR UPDATE",p);
        one("SELECT id FROM workflow_tasks WHERE tenant_id=:tenant AND id=:task FOR UPDATE",p);
        Map<String,Object> task=one(TASK_SELECT+" WHERE q.tenant_id=:tenant AND q.id=:task",p);
        if(!Set.of("PENDING","IN_PROGRESS","OVERDUE").contains(task.get("status").toString()))conflict("La tarea ya fue resuelta");
        p.put("previousStage",task.get("stage_id"));p.put("workflowStep",task.get("workflow_step_id"));
        if(!Set.of("STARTED","IN_PROGRESS").contains(flow.get("status").toString()))conflict("El workflow no está activo");
        String action=request.action();boolean escalation=action.equals("ESCALATE");p.put("previousStatus",flow.get("status"));
        if(!assigned(task,p)&&!(escalation&&context.hasAuthority("workflow:assign")))throw new AccessDeniedException("Solo el responsable puede actuar");
        p.put("template",flow.get("workflow_template_id"));p.put("document",task.get("document_id"));p.put("comment",request.comment());
        String type=Objects.toString(task.get("stage_type"),"TASK");
        if(action.equals("BEGIN")) {
            if(!task.get("status").equals("PENDING")&&!task.get("status").equals("OVERDUE"))conflict("La tarea ya está en progreso");
            db.update("UPDATE workflow_tasks SET status='IN_PROGRESS',started_at=now() WHERE tenant_id=:tenant AND id=:task",p);
        } else if(escalation) {
            permit("workflow:assign");requireComment(request.comment());requireActiveUser(request.targetUserId(),p);
            assertUserPermission(request.targetUserId(),type.equals("APPROVAL")?"workflow:approve":type.equals("REVIEW")?"workflow:review":"task:update",p);
            if(type.equals("APPROVAL"))assertSuperior(request.targetUserId(),uuid(task.get("creator_id")),uuid(task.get("document_author_id")),p);
            db.update("UPDATE workflow_tasks SET assigned_user_id=:user,assigned_role_id=NULL,assigned_department_id=NULL,assigned_group_id=NULL WHERE tenant_id=:tenant AND id=:task",p);
            notify(p,request.targetUserId(),"Tarea escalada",task.get("title").toString());
        } else if(action.equals("RETURN")) {
            permit("workflow:return");requireComment(request.comment());
            if(!ruleEnabled(task,"allowReturn"))throw new IllegalArgumentException("Esta etapa no permite devolución");
            requireActiveUser(request.targetUserId()==null?uuid(flow.get("creator_id")):request.targetUserId(),p);
            assertUserPermission(uuid(p.get("user")),"task:update",p);
            if(task.get("document_id")!=null)assertUserPermission(uuid(p.get("user")),"document:update",p);
            UUID returnStage=request.returnStageId()==null?uuid(task.get("stage_id")):request.returnStageId();
            Map<String,Object> dest=one("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND workflow_template_id=:template AND id=:returnStage",with(p,"returnStage",returnStage));
            if(!Set.of("TASK","REVIEW","APPROVAL").contains(dest.get("stage_type").toString()))throw new IllegalArgumentException("Etapa de retorno inválida");
            p.put("currentStage",task.get("stage_id"));
            Number currentOrder=(Number)one("SELECT sort_order FROM workflow_template_stages WHERE tenant_id=:tenant AND id=:currentStage",p).get("sort_order");
            if(((Number)dest.get("sort_order")).intValue()>currentOrder.intValue())throw new IllegalArgumentException("Solo se puede devolver a la etapa actual o una anterior");
            UUID stage=uuid(task.get("stage_id"));if(type.equals("APPROVAL"))recordApproval(p,task,"RETURNED",request.comment());finishTask(p,"CHANGES_REQUESTED");
            event(p,id,"RETURNED","CHANGES_REQUESTED",request.comment(),Map.of("target",p.get("user"),"returnStage",returnStage));
            createTask(p,stage,uuid(p.get("user")),true,returnStage,"Corrección: "+task.get("title"));
            documentStatusFor(p,"ON_RETURN");notify(p,uuid(flow.get("creator_id")),"WORKFLOW_RETURNED","Workflow devuelto para corrección",request.comment());
        } else if(action.equals("REJECT")) {
            permit("workflow:reject");requireComment(request.comment());
            if(!type.equals("APPROVAL")&&!type.equals("REVIEW"))throw new IllegalArgumentException("Esta tarea no admite rechazo");
            if(!ruleEnabled(task,"allowReject"))throw new IllegalArgumentException("Esta etapa no permite rechazo");
            if(type.equals("APPROVAL"))recordApproval(p,task,"REJECTED",request.comment());
            finishTask(p,"REJECTED");documentStatusFor(p,"ON_REJECT");
            UUID next=next(p,uuid(task.get("stage_id")),"REJECTED",false);
            if(next==null) {
                db.update("UPDATE workflows SET status='CANCELED',completed_at=now(),last_outcome='REJECTED' WHERE tenant_id=:tenant AND id=:id",p);
                notify(p,uuid(flow.get("creator_id")),"WORKFLOW_REJECTED","Workflow rechazado",request.comment());
            } else advance(p,next,"REJECTED",0);
        } else if(Set.of("APPROVE","REVIEW","COMPLETE").contains(action)) {
            if(!Boolean.TRUE.equals(task.get("correction"))) {
                if(type.equals("APPROVAL")) {
                    if(!action.equals("APPROVE"))throw new IllegalArgumentException("Esta etapa requiere aprobación");
                    permit("workflow:approve");if(!canApprove(task,p))throw new AccessDeniedException("Solo un superior puede aprobar; la autoaprobación requiere ser dueño del tenant");
                    if(task.get("document_id")!=null&&!Objects.equals(task.get("document_version"),task.get("current_version")))conflict("El documento cambió de versión: solicita revisión");
                } else if(type.equals("REVIEW")) {if(!action.equals("REVIEW"))throw new IllegalArgumentException("Esta etapa requiere revisión");permit("workflow:review");}
                else if(!action.equals("COMPLETE"))throw new IllegalArgumentException("Acción incompatible con la tarea");
            } else if(!action.equals("COMPLETE"))throw new IllegalArgumentException("Completa la corrección para reenviar");
            if(Boolean.TRUE.equals(task.get("correction"))&&task.get("document_id")!=null
                    &&Objects.equals(task.get("document_version"),task.get("current_version")))
                conflict("Sube una nueva versión del documento corregido antes de completar esta tarea");
            @SuppressWarnings("unchecked") Map<String,Object> rules=task.get("rules") instanceof Map?(Map<String,Object>)task.get("rules"):Map.of();
            if(Boolean.TRUE.equals(rules.get("commentRequired")))requireComment(request.comment());
            Map<String,Boolean> results=request.checklist()==null?Map.of():request.checklist();
            updateChecklist(p,task,results);
            if(!Boolean.TRUE.equals(task.get("correction"))&&db.queryForObject("SELECT count(*) FROM workflow_checklist_items WHERE tenant_id=:tenant AND task_id=:task AND required AND NOT completed",p,Long.class)>0)
                throw new IllegalArgumentException("Completa todos los puntos del checklist");
            String outcome=action.equals("APPROVE")?"APPROVED":action.equals("REVIEW")?"ACKNOWLEDGED":"ACKNOWLEDGED";
            if(type.equals("APPROVAL")&&action.equals("APPROVE"))recordApproval(p,task,"APPROVED",request.comment());
            finishTask(p,outcome);
            if(Boolean.TRUE.equals(task.get("correction")))advance(p,uuid(task.get("return_stage_id")),"DEFAULT",0);
            else {
                if(type.equals("APPROVAL"))documentStatusFor(p,"ON_APPROVE");
                UUID next=next(p,uuid(task.get("stage_id")),action.equals("APPROVE")?"APPROVED":"COMPLETED",true);
                advance(p,next,action.equals("APPROVE")?"APPROVED":"DEFAULT",0);
            }
        } else throw new IllegalArgumentException("Acción inválida");
        if(!action.equals("RETURN")) {
            Map<String,Object> versionTrace=new LinkedHashMap<>();versionTrace.put("documentVersion",task.get("document_version"));
            if(Boolean.TRUE.equals(task.get("correction")))versionTrace.put("correctedVersion",task.get("current_version"));
            event(p,id,action,action,request.comment(),versionTrace);
        }
        return task(id);
    }
    private void recordApproval(Map<String,Object> p,Map<String,Object> task,String decision,String comment) {
        Map<String,Object> approval=new HashMap<>(p);approval.put("approvalStep",task.get("workflow_step_id"));approval.put("approver",context.requireUserId());
        approval.put("decision",decision);approval.put("approvalComment",comment);
        approval.put("documentVersion",task.get("document_version"));
        db.update("INSERT INTO workflow_approvals(tenant_id,workflow_id,step_id,task_id,approver_user_id,decision,comment,document_version) VALUES(:tenant,:id,:approvalStep,:task,:approver,:decision,:approvalComment,:documentVersion)",approval);
    }
    private void updateChecklist(Map<String,Object> p,Map<String,Object> task,Map<String,Boolean> results) {
        List<Map<String,Object>> items=rows("SELECT id,label FROM workflow_checklist_items WHERE tenant_id=:tenant AND task_id=:task ORDER BY created_at,id",p);
        Set<String> allowed=new HashSet<>();items.forEach(item->allowed.add(item.get("label").toString()));
        if(!allowed.containsAll(results.keySet()))throw new IllegalArgumentException("Checklist inválido");
        if(!results.isEmpty())for(Map.Entry<String,Boolean> result:results.entrySet()) {
            Map<String,Object> values=new HashMap<>(p);values.put("label",result.getKey());values.put("completed",Boolean.TRUE.equals(result.getValue()));
            db.update("UPDATE workflow_checklist_items SET completed=:completed,completed_by=CASE WHEN :completed THEN :actor ELSE NULL END,completed_at=CASE WHEN :completed THEN now() ELSE NULL END WHERE tenant_id=:tenant AND task_id=:task AND label=:label",values);
        }
        Map<String,Boolean> snapshot=new LinkedHashMap<>();
        for(Map<String,Object> item:rows("SELECT label,completed FROM workflow_checklist_items WHERE tenant_id=:tenant AND task_id=:task ORDER BY created_at,id",p))
            snapshot.put(item.get("label").toString(),Boolean.TRUE.equals(item.get("completed")));
        p.put("checklist",json(snapshot));
        db.update("UPDATE workflow_tasks SET checklist_results=CAST(:checklist AS jsonb) WHERE tenant_id=:tenant AND id=:task",p);
    }
    private void assertUserPermission(UUID user,String permission,Map<String,Object> p) {
        p.put("assignee",user);p.put("needed",permission);
        Long count=db.queryForObject("SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id JOIN role_permissions rp ON rp.role_id=r.id AND rp.tenant_id=r.tenant_id JOIN permissions pe ON pe.id=rp.permission_id WHERE ur.tenant_id=:tenant AND ur.user_id=:assignee AND r.is_active AND pe.is_active AND pe.code=:needed",p,Long.class);
        if(count==0)throw new IllegalArgumentException("El responsable no tiene permiso para esta etapa");
    }
    private void assertSuperior(UUID candidate,UUID creator,UUID author,Map<String,Object> p) {
        Map<String,Object> candidateRank=rank(candidate,p);if(Boolean.TRUE.equals(candidateRank.get("owner")))return;
        for(UUID person:new UUID[]{creator,author})if(person!=null&&(person.equals(candidate)||((Number)candidateRank.get("rank")).intValue()<=((Number)rank(person,p).get("rank")).intValue()))
            throw new IllegalArgumentException("El aprobador debe ser superior al solicitante y al autor");
    }
    private void requireComment(String comment) {if(comment==null||comment.isBlank())throw new IllegalArgumentException("Es obligatorio indicar el motivo");}
    @SuppressWarnings("unchecked")
    private boolean ruleEnabled(Map<String,Object> task,String key) {
        Map<String,Object> rules=task.get("rules") instanceof Map?(Map<String,Object>)task.get("rules"):Map.of();
        return !Boolean.FALSE.equals(rules.get(key));
    }
    private void finishTask(Map<String,Object> p,String outcome) {
        p.put("outcome",outcome);p.put("taskStatus",outcome.equals("REJECTED")?"REJECTED":outcome.equals("CHANGES_REQUESTED")?"RETURNED":"COMPLETED");
        db.update("UPDATE workflow_tasks SET status=CAST(:taskStatus AS task_status),outcome=CAST(:outcome AS task_outcome),completed_at=now(),completed_by=:actor WHERE tenant_id=:tenant AND id=:task",p);
        if(p.get("workflowStep")!=null) {
            db.update("UPDATE workflow_steps SET status='COMPLETED',result=:outcome,completed_at=now(),updated_at=now() WHERE tenant_id=:tenant AND id=:workflowStep",p);
            event(p,uuid(p.get("task")),"STEP_COMPLETED",outcome,null,Map.of("stepId",p.get("workflowStep")));
        }
    }
    private UUID next(Map<String,Object> p,UUID stage,String outcome,boolean fallback) {
        p.put("stage",stage);p.put("outcome",outcome);p.put("fallback",fallback);
        List<Map<String,Object>> edges=rows("SELECT to_stage_id FROM workflow_template_transitions WHERE tenant_id=:tenant AND workflow_template_id=:template AND from_stage_id=:stage AND ((condition->>'outcome')=:outcome OR (:fallback AND coalesce(condition->>'outcome','DEFAULT')='DEFAULT')) ORDER BY CASE WHEN condition->>'outcome'=:outcome THEN 0 ELSE 1 END LIMIT 1",p);
        if(edges.isEmpty()){if(fallback)conflict("No existe una transición válida");return null;}return uuid(edges.get(0).get("to_stage_id"));
    }
    private void advance(Map<String,Object> p,UUID stageId,String outcome,int depth) {
        if(depth>50)conflict("Se excedió el límite de etapas automáticas");
        Map<String,Object> stage=one("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND id=:stage AND workflow_template_id=:template",with(p,"stage",stageId));
        db.update("UPDATE workflow_steps SET status='COMPLETED',result=:outcome,completed_at=coalesce(completed_at,now()),updated_at=now() WHERE tenant_id=:tenant AND workflow_id=:id AND status='ACTIVE'",with(p,"outcome",outcome));
        UUID stepInstance=createStepInstance(p,stage);
        p.put("stepInstance",stepInstance);
        db.update("UPDATE workflows SET current_stage_id=:stage,current_step_instance_id=:stepInstance,last_outcome=:outcome WHERE tenant_id=:tenant AND id=:id",p);
        event(p,null,"STEP_STARTED","ACTIVE",null,Map.of("stepId",stepInstance,"stageId",stageId));
        String type=stage.get("stage_type").toString();
        if(type.equals("END")) {
            db.update("UPDATE workflow_steps SET status='COMPLETED',result='COMPLETED',completed_at=now(),updated_at=now() WHERE tenant_id=:tenant AND id=:stepInstance",p);
            db.update("UPDATE workflows SET status='COMPLETED',completed_at=now() WHERE tenant_id=:tenant AND id=:id",p);
            documentStatusFor(p,"ON_COMPLETE");
            Map<String,Object> flow=one("SELECT creator_id FROM workflows WHERE tenant_id=:tenant AND id=:id",p);
            event(p,null,"COMPLETED","COMPLETED",null,Map.of());
            String finalNotice="APPROVED".equals(outcome)?"WORKFLOW_APPROVED":"WORKFLOW_COMPLETED";
            notify(p,uuid(flow.get("creator_id")),finalNotice,"Workflow finalizado","El flujo ha finalizado");return;
        }
        if(Set.of("TASK","REVIEW","APPROVAL").contains(type)) {
            UUID user=resolveAssignee(p,stage);
            createTask(p,stageId,user,false,null,stage.get("name").toString());
            if(type.equals("REVIEW")||type.equals("APPROVAL"))documentStatusFor(p,"ON_REVIEW");return;
        }
        if(type.equals("NOTIFICATION")) {
            Map<String,Object> flow=one("SELECT creator_id FROM workflows WHERE tenant_id=:tenant AND id=:id",p);
            @SuppressWarnings("unchecked") Map<String,Object> rules=(Map<String,Object>)stage.get("rules");
            for(UUID recipient:notificationRecipients(p,stage,uuid(flow.get("creator_id"))))
                notify(p,recipient,stage.get("name").toString(),Objects.toString(rules.get("message"),"El workflow avanzó de etapa"));
        }
        if(type.equals("ARCHIVE"))documentStatusFor(p,"ON_ARCHIVE");
        db.update("UPDATE workflow_steps SET status='COMPLETED',result=:outcome,completed_at=now(),updated_at=now() WHERE tenant_id=:tenant AND id=:stepInstance",p);
        event(p,null,"STAGE_COMPLETED",type,null,Map.of("stageId",stageId));
        String branch=type.equals("DECISION")?(outcome.equals("REJECTED")?"NO":"YES"):outcome;
        advance(p,next(p,stageId,branch,true),outcome,depth+1);
    }
    private List<UUID> notificationRecipients(Map<String,Object> p,Map<String,Object> stage,UUID fallback) {
        String type=Objects.toString(stage.get("assignment_type"),"");
        if(type.isBlank())return List.of(fallback);
        if(type.equals("USER")){UUID recipient=uuid(stage.get("assignment_reference"));requireActiveUser(recipient,p);return List.of(recipient);}
        p.put("recipientRef",stage.get("assignment_reference"));
        String predicate=switch(type){
            case "ROLE"->"EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id WHERE ur.tenant_id=u.tenant_id AND ur.user_id=u.id AND r.is_active AND ur.role_id::text=:recipientRef)";
            case "DEPARTMENT"->"u.department_id::text=:recipientRef";
            case "GROUP"->"EXISTS(SELECT 1 FROM user_group_members gm WHERE gm.tenant_id=u.tenant_id AND gm.user_id=u.id AND gm.group_id::text=:recipientRef)";
            default->throw new IllegalArgumentException("Destinatario de notificación inválido");};
        return db.queryForList("SELECT u.id FROM users u WHERE u.tenant_id=:tenant AND u.deleted_at IS NULL AND u.status::text='ACTIVE' AND "+predicate,p,UUID.class);
    }
    private UUID resolveAssignee(Map<String,Object> p,Map<String,Object> stage) {
        Map<String,Object> flow=one("SELECT * FROM workflows WHERE tenant_id=:tenant AND id=:id",p);
        @SuppressWarnings("unchecked") Map<String,Object> assignments=(Map<String,Object>)flow.get("assignments");
        @SuppressWarnings("unchecked") Map<String,Object> rules=(Map<String,Object>)stage.get("rules");
        Object override=assignments.get(Objects.toString(rules.get("key"),stage.get("id").toString()));
        if(override==null)override=assignments.get(stage.get("id").toString());
        UUID user=override==null?null:uuid(override);
        if(user==null&&"USER".equals(stage.get("assignment_type")))user=uuid(stage.get("assignment_reference"));
        String permission=stage.get("stage_type").equals("APPROVAL")?"workflow:approve":stage.get("stage_type").equals("REVIEW")?"workflow:review":"task:update";
        if(user==null) {
            p.put("reference",stage.get("assignment_reference"));p.put("needed",permission);
            String filter=switch(Objects.toString(stage.get("assignment_type"),"")) {
                case "ROLE"->" AND (r.id::text=:reference OR r.name=:reference)";case "DEPARTMENT"->" AND u.department_id::text=:reference";
                case "GROUP"->" AND EXISTS(SELECT 1 FROM user_group_members gm WHERE gm.tenant_id=u.tenant_id AND gm.user_id=u.id AND gm.group_id::text=:reference)";default->"";};
            List<Map<String,Object>> candidates=rows("SELECT DISTINCT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id AND ur.tenant_id=u.tenant_id JOIN roles r ON r.id=ur.role_id AND r.tenant_id=ur.tenant_id JOIN role_permissions rp ON rp.role_id=r.id AND rp.tenant_id=r.tenant_id JOIN permissions pe ON pe.id=rp.permission_id WHERE u.tenant_id=:tenant AND u.status::text='ACTIVE' AND u.deleted_at IS NULL AND r.is_active AND pe.is_active AND pe.code=:needed"+filter+" ORDER BY u.id",p);
            for(Map<String,Object> candidate:candidates) {
                UUID proposed=uuid(candidate.get("id"));
                try{if(stage.get("stage_type").equals("APPROVAL"))assertSuperior(proposed,uuid(flow.get("creator_id")),documentAuthor(p),p);user=proposed;break;}
                catch(IllegalArgumentException ignored){}
            }
        }
        if(user==null)throw new IllegalArgumentException("No hay responsable elegible para "+stage.get("name"));
        requireActiveUser(user,p);assertUserPermission(user,permission,p);
        if(stage.get("stage_type").equals("APPROVAL"))assertSuperior(user,uuid(flow.get("creator_id")),documentAuthor(p),p);
        return user;
    }
    private UUID documentAuthor(Map<String,Object> p) {
        if(p.get("document")==null)return null;return uuid(one("SELECT author_id FROM documents WHERE tenant_id=:tenant AND id=:document",p).get("author_id"));
    }
    private void createTask(Map<String,Object> p,UUID stage,UUID user,boolean correction,UUID returnStage,String title) {
        Map<String,Object> flow=one("SELECT * FROM workflows WHERE tenant_id=:tenant AND id=:id",p);
        Map<String,Object> node=one("SELECT * FROM workflow_template_stages WHERE tenant_id=:tenant AND id=:stage",with(p,"stage",stage));
        if(correction||p.get("stepInstance")==null){p.put("stepInstance",createStepInstance(p,node));db.update("UPDATE workflows SET current_step_instance_id=:stepInstance WHERE tenant_id=:tenant AND id=:id",p);}
        @SuppressWarnings("unchecked") Map<String,Object> nodeRules=node.get("rules") instanceof Map?(Map<String,Object>)node.get("rules"):Map.of();
        Map<String,Object> q=new HashMap<>(p);q.put("newTask",UUID.randomUUID());q.put("user",user);q.put("title",title);q.put("priority",nodeRules.get("priority") instanceof Number?nodeRules.get("priority"):flow.get("priority"));q.put("correction",correction);q.put("returnStage",returnStage);
        Object due=flow.get("due_at");if(node.get("due_days")!=null) {
            OffsetDateTime nodeDue=OffsetDateTime.now().plusDays(((Number)node.get("due_days")).longValue());
            if(due==null||OffsetDateTime.parse(due.toString()).isAfter(nodeDue))due=nodeDue;
        }
        q.put("due",due==null?null:OffsetDateTime.parse(due.toString()));
        Object version=p.get("document")==null?null:one("SELECT current_version FROM documents WHERE tenant_id=:tenant AND id=:document",p).get("current_version");q.put("version",version);
        q.put("stepInstance",p.get("stepInstance"));
        db.update("INSERT INTO workflow_tasks(id,tenant_id,workflow_id,stage_id,workflow_step_id,document_id,title,assigned_user_id,status,priority,document_version,due_at,correction,return_stage_id) VALUES(:newTask,:tenant,:id,:stage,:stepInstance,:document,:title,:user,'PENDING',:priority,:version,:due,:correction,:returnStage)",q);
        List<?> checklist=nodeRules.get("checklist") instanceof List?(List<?>)nodeRules.get("checklist"):List.of();
        for(Object label:checklist) {
            Map<String,Object> item=new HashMap<>(q);item.put("label",label.toString());
            db.update("INSERT INTO workflow_checklist_items(tenant_id,workflow_id,step_id,task_id,label,required) VALUES(:tenant,:id,:stepInstance,:newTask,:label,true) ON CONFLICT(tenant_id,task_id,label) DO NOTHING",item);
        }
        event(p,uuid(q.get("newTask")),"TASK_ASSIGNED","PENDING",null,Map.of("assignedUser",user));
        String noticeType=node.get("stage_type").equals("REVIEW")?"REVIEW_REQUIRED":node.get("stage_type").equals("APPROVAL")?"APPROVAL_REQUIRED":"TASK_ASSIGNED";
        notify(p,user,noticeType,"Nueva tarea",title);
    }
    private UUID createStepInstance(Map<String,Object> p,Map<String,Object> stage) {
        Map<String,Object> step=new HashMap<>(p);UUID id=UUID.randomUUID();step.put("newStep",id);step.put("templateStep",stage.get("id"));step.put("stepName",stage.get("name"));
        @SuppressWarnings("unchecked") Map<String,Object> rules=stage.get("rules") instanceof Map?(Map<String,Object>)stage.get("rules"):Map.of();
        step.put("stepDescription",Objects.toString(rules.get("description"),null));step.put("stepType",stage.get("stage_type"));step.put("stepOrder",stage.get("sort_order"));
        Object due=null;if(stage.get("due_days")!=null)due=OffsetDateTime.now().plusDays(((Number)stage.get("due_days")).longValue());step.put("stepDue",due);
        db.update("INSERT INTO workflow_steps(id,tenant_id,workflow_id,template_step_id,name,description,step_type,order_index,status,started_at,due_at) VALUES(:newStep,:tenant,:id,:templateStep,:stepName,:stepDescription,:stepType,:stepOrder,'ACTIVE',now(),:stepDue)",step);
        return id;
    }
    private void documentStatus(Map<String,Object> p,String status) {
        if(p.get("document")==null)return;p.put("documentStatus",status);
        if(db.update("UPDATE documents SET status=CAST(:documentStatus AS document_status) WHERE tenant_id=:tenant AND id=:document AND deleted_at IS NULL",p)!=1)throw new AccessDeniedException("No se pudo actualizar el documento");
    }
    @SuppressWarnings("unchecked")
    private void documentStatusFor(Map<String,Object> p,String event) {
        if(p.get("document")==null)return;
        Object raw=p.get("statusRules");
        if(raw==null)raw=one("SELECT document_status_rules FROM workflows WHERE tenant_id=:tenant AND id=:id",p).get("document_status_rules");
        if(raw instanceof String text)raw=parse(text);
        Map<String,Object> rules=raw instanceof Map?(Map<String,Object>)raw:Map.of();
        Object status=rules.get(event);
        if(status!=null&&!"UNCHANGED".equals(status.toString()))documentStatus(p,status.toString());
    }
    private Map<String,String> validatedDocumentStatusRules(Map<String,String> supplied) {
        Map<String,String> rules=new LinkedHashMap<>(Map.of("ON_START","UNCHANGED","ON_REVIEW","IN_REVIEW",
            "ON_APPROVE","APPROVED","ON_REJECT","REJECTED","ON_RETURN","DRAFT","ON_ARCHIVE","ARCHIVED","ON_COMPLETE","UNCHANGED"));
        if(supplied!=null)for(var entry:supplied.entrySet()) {
            if(!rules.containsKey(entry.getKey()))throw new IllegalArgumentException("Evento de estado documental no permitido: "+entry.getKey());
            if(entry.getValue()==null||!Set.of("DRAFT","PENDING","IN_REVIEW","APPROVED","REJECTED","CURRENT","ARCHIVED","VOIDED","TRASHED","UNCHANGED").contains(entry.getValue()))
                throw new IllegalArgumentException("Estado documental no permitido para "+entry.getKey());
            rules.put(entry.getKey(),entry.getValue());
        }
        return rules;
    }
    private void event(Map<String,Object> p,UUID task,String type,String result,String comment,Map<String,Object> details) {
        Map<String,Object> trace=new LinkedHashMap<>(details);
        Map<String,Object> state=one("SELECT current_stage_id,status,expedient_id FROM workflows WHERE tenant_id=:tenant AND id=:id",p);
        trace.put("toStage",state.get("current_stage_id"));trace.put("workflowStatus",state.get("status").toString());
        trace.put("fromStatus",Objects.toString(p.get("previousStatus"),state.get("status").toString()));trace.put("toStatus",state.get("status"));
        if(p.get("previousStage")!=null)trace.put("fromStage",p.get("previousStage"));
        Map<String,Object> e=new HashMap<>(p);e.put("eventTask",task);e.put("event",type);e.put("result",result);e.put("comment",comment);e.put("details",json(trace));
        if(!e.containsKey("document"))e.put("document",null);
        db.update("INSERT INTO workflow_events(tenant_id,workflow_id,task_id,document_id,event_type,performed_by,result,comment,details,performed_at) VALUES(:tenant,:id,:eventTask,:document,:event,:actor,:result,:comment,CAST(:details AS jsonb),clock_timestamp())",e);
        Map<String,Object> audit=new HashMap<>(p);audit.put("auditAction",auditAction(type));audit.put("auditTask",task);audit.put("auditStep",p.getOrDefault("workflowStep",p.get("stepInstance")));
        audit.put("auditDocument",p.get("document"));audit.put("auditExpedient",state.get("expedient_id"));
        audit.put("fromStatus",trace.get("fromStatus"));audit.put("toStatus",state.get("status"));
        audit.put("metadata",json(trace));
        db.queryForList("SELECT app.record_workflow_audit(:auditAction,:id,:auditTask,:auditStep,:auditDocument,:auditExpedient,:fromStatus,:toStatus,CAST(:metadata AS jsonb))",audit);
        p.put("previousStatus",state.get("status"));
    }
    private String auditAction(String type) {
        return switch(type) {
            case "STARTED"->"WORKFLOW_STARTED";case "PAUSE"->"WORKFLOW_PAUSED";case "RESUME"->"WORKFLOW_RESUMED";
            case "CANCEL"->"WORKFLOW_CANCELLED";case "COMPLETED"->"WORKFLOW_COMPLETED";
            case "STEP_STARTED"->"WORKFLOW_STEP_STARTED";case "STEP_COMPLETED"->"WORKFLOW_STEP_COMPLETED";
            case "TASK_ASSIGNED"->"WORKFLOW_TASK_ASSIGNED";case "APPROVE"->"WORKFLOW_APPROVED";
            case "COMPLETE","REVIEW"->"WORKFLOW_TASK_COMPLETED";
            case "REJECT"->"WORKFLOW_REJECTED";case "RETURNED"->"WORKFLOW_RETURNED";
            default->"WORKFLOW_"+type.replaceAll("[^A-Z0-9_]","_");
        };
    }
    private void notify(Map<String,Object> p,UUID recipient,String title,String message) {
        notify(p,recipient,"WORKFLOW",title,message);
    }
    private void notify(Map<String,Object> p,UUID recipient,String type,String title,String message) {
        if(recipient==null)return;
        Map<String,Object> n=new HashMap<>(p);n.put("recipient",recipient);n.put("noticeType",type);n.put("noticeTitle",title);n.put("message",message);
        db.update("INSERT INTO notifications(tenant_id,user_id,type,title,message,related_entity_type,related_entity_id) VALUES(:tenant,:recipient,:noticeType,:noticeTitle,:message,'workflow',:id)",n);
    }
    public void comment(UUID task,Comment comment) {
        Map<String,Object> detail=task(task);permit("task:update");Map<String,Object> p=with(scope(),"task",task);
        p.put("id",detail.get("workflow_id"));p.put("document",detail.get("document_id"));p.put("comment",comment.comment());
        db.update("INSERT INTO workflow_comments(tenant_id,workflow_id,task_id,document_id,author_id,comment_text) VALUES(:tenant,:id,:task,:document,:actor,:comment)",p);
        event(p,task,"COMMENTED","COMMENTED",comment.comment(),Map.of());
    }
    public void lifecycle(UUID id,Lifecycle request) {
        Map<String,Object> p=with(scope(),"id",id);Map<String,Object> flow=one("SELECT * FROM workflows WHERE tenant_id=:tenant AND id=:id AND deleted_at IS NULL FOR UPDATE",p);
        String action=request.action();String status=flow.get("status").toString();p.put("previousStatus",status);
        switch(action) {
            case "PAUSE"->{permit("workflow:pause");if(!Set.of("STARTED","IN_PROGRESS").contains(status))conflict("Solo se puede pausar un workflow activo");status="PAUSED";}
            case "RESUME"->{permit("workflow:pause");if(!status.equals("PAUSED"))conflict("El workflow no está pausado");status="IN_PROGRESS";}
            case "CANCEL"->{permit("workflow:cancel");requireComment(request.comment());if(Set.of("COMPLETED","CANCELED").contains(status))conflict("El workflow ya finalizó");status="CANCELED";
                db.update("UPDATE workflow_tasks SET status='CANCELED' WHERE tenant_id=:tenant AND workflow_id=:id AND status IN ('PENDING','IN_PROGRESS','OVERDUE')",p);
                db.update("UPDATE workflow_steps SET status='CANCELED',completed_at=now(),updated_at=now() WHERE tenant_id=:tenant AND workflow_id=:id AND status='ACTIVE'",p);}
            default->throw new IllegalArgumentException("Acción inválida");
        }
        p.put("status",status);db.update("UPDATE workflows SET status=CAST(:status AS workflow_status),completed_at=CASE WHEN :status='CANCELED' THEN now() ELSE completed_at END WHERE tenant_id=:tenant AND id=:id",p);
        event(p,null,action,status,request.comment(),Map.of("from",flow.get("status").toString(),"to",status));
        String notice=action.equals("CANCEL")?"WORKFLOW_CANCELLED":"WORKFLOW";
        notify(p,uuid(flow.get("creator_id")),notice,"Workflow: "+action,Objects.toString(request.comment(),"Cambio de estado"));
    }
    public Map<String,Object> notifications(Map<String,String> filters) {
        permit("notification:read");return page("SELECT n.* FROM notifications n"," WHERE n.tenant_id=:tenant AND n.user_id=:actor AND n.archived_at IS NULL",scope(),filters,"n.created_at");
    }
    public void readNotification(UUID id) {
        permit("notification:read");Map<String,Object> p=with(scope(),"id",id);
        db.update("UPDATE notifications SET is_read=true,read_at=now() WHERE tenant_id=:tenant AND user_id=:actor AND id=:id",p);
    }
    public void hierarchy(long role,Hierarchy request) {
        Map<String,Object> p=scope();if(!Boolean.TRUE.equals(rank(context.requireUserId(),p).get("owner")))throw new AccessDeniedException("Solo el dueño puede configurar la jerarquía");
        p.put("role",role);p.put("rank",request.rank());
        // Existing role update permission/RLS remains mandatory.
        if(db.update("UPDATE roles SET approval_rank=:rank WHERE tenant_id=:tenant AND id=:role AND NOT workflow_owner",p)!=1)throw new IllegalArgumentException("El rol dueño no puede degradarse");
    }
    public void checklist(UUID id,Map<String,Boolean> results) {
        permit("task:update");Map<String,Object> p=with(scope(),"task",id);
        Map<String,Object> task=one(TASK_SELECT+" WHERE q.tenant_id=:tenant AND q.id=:task",p);
        p.put("id",task.get("workflow_id"));
        one("SELECT id FROM workflows WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);
        one("SELECT id FROM workflow_tasks WHERE tenant_id=:tenant AND id=:task FOR UPDATE",p);
        task=one(TASK_SELECT+" WHERE q.tenant_id=:tenant AND q.id=:task",p);
        if(!assigned(task,p))throw new AccessDeniedException("Tarea no asignada");
        if(!Set.of("PENDING","IN_PROGRESS","OVERDUE").contains(task.get("status").toString())
          || !Set.of("STARTED","IN_PROGRESS").contains(task.get("workflow_status").toString()))conflict("La tarea no está activa");
        updateChecklist(p,task,results);
    }
    public void edit(UUID id,Edit request) {
        permit("workflow:update");Map<String,Object> p=with(scope(),"id",id);
        Map<String,Object> flow=one("SELECT * FROM workflows WHERE tenant_id=:tenant AND id=:id AND deleted_at IS NULL FOR UPDATE",p);
        if(Set.of("COMPLETED","CANCELED").contains(flow.get("status").toString()))conflict("Un workflow finalizado no puede editarse");
        if(request.dueAt()!=null&&request.dueAt().isBefore(OffsetDateTime.now()))throw new IllegalArgumentException("Fecha límite inválida");
        p.put("title",request.title());p.put("description",request.description());p.put("priority",request.priority());p.put("due",request.dueAt());
        db.update("UPDATE workflows SET title=:title,description=:description,priority=:priority,due_at=:due WHERE tenant_id=:tenant AND id=:id",p);
        db.update("UPDATE workflow_tasks SET priority=:priority,due_at=:due WHERE tenant_id=:tenant AND workflow_id=:id AND status IN ('PENDING','IN_PROGRESS','OVERDUE')",p);
        event(p,null,"EDITED","UPDATED",null,Map.of("fields",List.of("title","description","priority","dueAt")));
    }
    public Map<String,Object> summary(Map<String,String> filters) {
        permit("workflow:read");Map<String,Object> p=scope();Map<String,Object> flows=new LinkedHashMap<>(),tasks=new LinkedHashMap<>();
        for(String bucket:List.of("all","active","review","pending","completed","draft")) {
            String condition=switch(bucket){case "active"->" AND w.status IN ('STARTED','IN_PROGRESS')";case "review"->" AND w.status IN ('STARTED','IN_PROGRESS') AND s.stage_type='REVIEW'";case "pending"->" AND w.status IN ('STARTED','IN_PROGRESS') AND s.stage_type IN ('TASK','APPROVAL')";case "completed"->" AND w.status='COMPLETED'";case "draft"->" AND w.status='DRAFT'";default->"";};
            flows.put(bucket,db.queryForObject("SELECT count(*) FROM workflows w LEFT JOIN workflow_template_stages s ON s.id=w.current_stage_id AND s.tenant_id=w.tenant_id WHERE w.tenant_id=:tenant AND w.deleted_at IS NULL"+condition,p,Long.class));
        }
        for(String status:List.of("PENDING","IN_PROGRESS","COMPLETED","overdue")) {
            p.put("status",status);String condition=status.equals("overdue")?"q.due_at<now() AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')":"q.status::text=:status";
            tasks.put(status,db.queryForObject("SELECT count(*) FROM workflow_tasks q WHERE q.tenant_id=:tenant AND "+MY_TASK+" AND "+condition,p,Long.class));
        }
        List<String> categories=db.queryForList("SELECT DISTINCT category FROM workflow_templates WHERE tenant_id=:tenant ORDER BY category",p,String.class);
        StringBuilder completedWhere=new StringBuilder(" WHERE w.tenant_id=:tenant AND w.deleted_at IS NULL AND w.status='COMPLETED'");
        for(String key:List.of("startedFrom","startedTo","completedFrom","completedTo"))if(filters.get(key)!=null&&!filters.get(key).isBlank()) {
            p.put(key,filters.get(key));completedWhere.append(" AND w.").append(key.startsWith("started")?"started_at":"completed_at")
              .append(key.endsWith("From")?">=CAST(:":"<CAST(:").append(key).append(key.endsWith("From")?" AS date)":" AS date)+interval '1 day'");
        }
        Map<String,Object> completed=one("""
            SELECT count(*) FILTER(WHERE completed_at>=date_trunc('month',now())) AS this_month,
              coalesce(round((avg(extract(epoch FROM (completed_at-started_at))) FILTER(WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)/3600.0)::numeric,1),0) AS average_hours,
              count(*) FILTER(WHERE status='COMPLETED' AND last_outcome='APPROVED'
                AND NOT EXISTS(SELECT 1 FROM workflow_events event WHERE event.tenant_id=w.tenant_id
                  AND event.workflow_id=w.id AND event.event_type='RETURNED')) AS approved_without_changes
            FROM workflows w
            """+completedWhere,p);
        Map<String,Object> widgets=one("""
            SELECT count(*) FILTER(WHERE q.status IN ('PENDING','IN_PROGRESS','OVERDUE')) AS my_tasks,
              count(*) FILTER(WHERE s.stage_type='REVIEW' AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')) AS reviews,
              count(*) FILTER(WHERE s.stage_type='APPROVAL' AND q.status IN ('PENDING','IN_PROGRESS','OVERDUE')) AS approvals,
              count(*) FILTER(WHERE q.status IN ('PENDING','IN_PROGRESS','OVERDUE') AND q.due_at>=now() AND q.due_at<now()+interval '24 hours') AS due_soon
            FROM workflow_tasks q JOIN workflows w ON w.id=q.workflow_id AND w.tenant_id=q.tenant_id
            LEFT JOIN workflow_template_stages s ON s.id=q.stage_id AND s.tenant_id=q.tenant_id
            WHERE q.tenant_id=:tenant AND w.deleted_at IS NULL AND """+MY_TASK,p);
        return Map.of("flows",flows,"tasks",tasks,"categories",categories,"completed",completed,"widgets",widgets);
    }
}
