package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.exception.NotFoundException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional
public class DocumentRetentionService {
    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;
    private final AuditRecorder audit;
    private final ComponentPermissionService components;
    public DocumentRetentionService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context, AuditRecorder audit, ComponentPermissionService components) {
        this.db=db; this.context=context; this.audit=audit; this.components=components;
    }
    private Map<String,Object> scope() {
        context.establishDatabaseContext();
        var p=new HashMap<String,Object>(); p.put("tenant",context.requireTenantId()); p.put("actor",context.requireUserId()); return p;
    }
    private Map<String,Object> one(String sql,Map<String,Object> p) {
        var rows=db.queryForList(sql,p); if(rows.isEmpty())throw new NotFoundException("Registro no encontrado"); return rows.get(0);
    }
    public List<Map<String,Object>> policies() {
        return db.queryForList("SELECT p.*, (SELECT count(*) FROM document_types t WHERE t.tenant_id=p.tenant_id AND t.retention_policy_id=p.id) AS type_count FROM retention_policies p WHERE p.tenant_id=:tenant ORDER BY p.name",scope());
    }
    public List<Map<String,Object>> types() {
        return db.queryForList("SELECT id,name,code,retention_policy_id FROM document_types WHERE tenant_id=:tenant AND is_active ORDER BY name",scope());
    }
    static void validatePolicy(String name,Integer months,String action,boolean indefinite) {
        if(name==null||name.trim().isEmpty()||name.trim().length()>120||action==null||!Set.of("KEEP","TRANSFER","DELETE","REVIEW","ARCHIVE","ANONYMIZE").contains(action)
                ||(indefinite?(months!=null||Set.of("TRANSFER","DELETE").contains(action)):(months==null||months<0||months>1200)))
            throw new IllegalArgumentException("Politica invalida: define 0 a 1200 meses, o conservacion indefinida sin transferencia ni eliminacion");
    }
    public Map<String,Object> save(UUID id,String name,Integer months,String action,boolean active,boolean indefinite) {
        validatePolicy(name,months,action,indefinite);
        var p=scope(); p.put("id",id==null?UUID.randomUUID():id);p.put("name",name.trim());p.put("months",months);p.put("action",action);p.put("active",active);
        String sql=id==null?"INSERT INTO retention_policies(id,tenant_id,name,retention_months,disposition_action,is_active) VALUES(:id,:tenant,:name,:months,:action,:active) RETURNING *":"UPDATE retention_policies SET name=:name,retention_months=:months,disposition_action=:action,is_active=:active,updated_at=now() WHERE tenant_id=:tenant AND id=:id RETURNING *";
        var result=one(sql,p);var detail=new LinkedHashMap<String,Object>(Map.of("name",name.trim(),"action",action,"active",active));detail.put("months",months);
        audit.record(id==null?"RETENTION_CREATED":"RETENTION_UPDATED","RETENTION_POLICIES",(UUID)p.get("id"),null,detail);return result;
    }
    public void remove(UUID id) {
        var p=scope();p.put("id",id);one("SELECT id FROM retention_policies WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);
        if(db.queryForObject("SELECT (SELECT count(*) FROM document_types WHERE tenant_id=:tenant AND retention_policy_id=:id)+(SELECT count(*) FROM document_transfers WHERE tenant_id=:tenant AND policy_id=:id)",p,Long.class)>0)throw new IllegalStateException("La politica esta asociada a tipos o transferencias; desactivala para conservar sus referencias");
        db.update("DELETE FROM retention_policies WHERE tenant_id=:tenant AND id=:id",p);audit.record("RETENTION_DELETED","RETENTION_POLICIES",id,null,null);
    }
    public void assign(UUID type,UUID policy) {
        var p=scope();p.put("id",type);p.put("policy",policy);
        if(policy!=null)one("SELECT id FROM retention_policies WHERE tenant_id=:tenant AND id=:policy AND is_active FOR SHARE",p);
        if(db.update("UPDATE document_types SET retention_policy_id=:policy,updated_at=now() WHERE tenant_id=:tenant AND id=:id",p)!=1)throw new NotFoundException("Tipo no encontrado");
        audit.record("RETENTION_ASSIGNED","DOCUMENT_TYPES",type,null,Collections.singletonMap("policyId",policy));
    }
    private static final String DOCUMENT_QUERY="""
        SELECT d.id,d.name,d.code,d.status::text,d.archive_level,
          coalesce(d.archive_level_since,d.issue_date,d.created_at::date) AS period_start,
          t.name AS type_name,p.id AS policy_id,p.name AS policy_name,p.retention_months,p.disposition_action,p.is_active,
          (coalesce(d.archive_level_since,d.issue_date,d.created_at::date)+make_interval(months=>p.retention_months))::date AS eligible_on,
          EXISTS(SELECT 1 FROM workflow_documents wd JOIN workflows w ON w.id=wd.workflow_id AND w.tenant_id=wd.tenant_id
            WHERE wd.tenant_id=d.tenant_id AND wd.document_id=d.id AND w.status IN ('STARTED','IN_PROGRESS','PAUSED') AND w.deleted_at IS NULL) AS workflow_active
        FROM documents d JOIN document_types t ON t.id=d.document_type_id AND t.tenant_id=d.tenant_id
        LEFT JOIN retention_policies p ON p.id=t.retention_policy_id AND p.tenant_id=t.tenant_id
        WHERE d.tenant_id=:tenant AND d.deleted_at IS NULL
        """;
    private void hide(List<Map<String,Object>> rows) {
        var access=components.current(ComponentFormCatalog.DOCUMENT_FORM);
        for(var row:rows) {if(!access.visible("nombre"))row.put("name",null);if(!access.visible("codigo"))row.put("code",null);}
    }
    public List<Map<String,Object>> due(int days) {
        if(days<0||days>3650)throw new IllegalArgumentException("Horizonte invalido");
        var p=scope();p.put("days",days);
        var rows=db.queryForList(DOCUMENT_QUERY+" AND d.status NOT IN ('TRASHED','VOIDED') AND p.is_active AND p.retention_months IS NOT NULL AND (coalesce(d.archive_level_since,d.issue_date,d.created_at::date)+make_interval(months=>p.retention_months))::date<=current_date+:days ORDER BY eligible_on,d.id LIMIT 500",p);hide(rows);return rows;
    }
    public List<Map<String,Object>> candidates() {
        var rows=db.queryForList("SELECT * FROM ("+DOCUMENT_QUERY+") q WHERE q.is_active AND q.disposition_action='TRANSFER' AND q.eligible_on<=current_date AND q.status IN ('CURRENT','APPROVED','ARCHIVED') AND q.archive_level IN ('MANAGEMENT','CENTRAL') AND NOT q.workflow_active AND NOT EXISTS(SELECT 1 FROM document_transfers x WHERE x.tenant_id=:tenant AND x.document_id=q.id AND x.status IN ('REQUESTED','APPROVED')) ORDER BY q.eligible_on,q.id LIMIT 500",scope());
        hide(rows);return rows;
    }
    private Map<String,Object> lockedDocument(UUID id,Map<String,Object> p) {
        p.put("document",id);
        // Lock the document first, then its type and policy, for all transfer stages.
        one("SELECT id FROM documents WHERE tenant_id=:tenant AND id=:document AND deleted_at IS NULL FOR UPDATE",p);
        var row=one(DOCUMENT_QUERY+" AND d.id=:document FOR SHARE OF t",p);
        if(row.get("policy_id")!=null) {p.put("policy",row.get("policy_id"));one("SELECT id FROM retention_policies WHERE tenant_id=:tenant AND id=:policy FOR SHARE",p);row=one(DOCUMENT_QUERY+" AND d.id=:document",p);}
        return row;
    }
    static String nextLevel(String source) {
        return switch(source){case "MANAGEMENT"->"CENTRAL";case "CENTRAL"->"HISTORICAL";default->throw new IllegalArgumentException("El archivo historico es el ultimo nivel");};
    }
    static void disposable(Map<String,Object> row,LocalDate today) {
        if(!Boolean.TRUE.equals(row.get("is_active"))||!"DELETE".equals(row.get("disposition_action"))||row.get("eligible_on")==null)
            throw new IllegalStateException("La eliminacion requiere una politica vigente con accion Eliminar y plazo definido");
        if(LocalDate.parse(row.get("eligible_on").toString()).isAfter(today))throw new IllegalStateException("El documento aun debe conservarse hasta cumplir el plazo");
    }
    public void requireDisposalPolicy(UUID document) {
        disposable(lockedDocument(document,scope()),LocalDate.now());
    }
    static void eligible(Map<String,Object> row,String target,LocalDate today) {
        if(!Boolean.TRUE.equals(row.get("is_active"))||!"TRANSFER".equals(row.get("disposition_action"))||row.get("retention_months")==null)throw new IllegalStateException("Se requiere una politica vigente con accion Transferir");
        if(!Set.of("CURRENT","APPROVED","ARCHIVED").contains(row.get("status"))||Boolean.TRUE.equals(row.get("workflow_active")))throw new IllegalStateException("El documento no esta cerrado para transferencia o tiene un workflow activo");
        if(!nextLevel(row.get("archive_level").toString()).equals(target))throw new IllegalArgumentException("Solo se permite transferir al siguiente nivel de archivo");
        if(LocalDate.parse(row.get("eligible_on").toString()).isAfter(today))throw new IllegalStateException("El documento todavia no cumplio su periodo de conservacion");
    }
    public Map<String,Object> request(UUID document,String target,String reason) {
        if(reason==null||reason.trim().length()<10||reason.trim().length()>1000)throw new IllegalArgumentException("Motivo requerido de 10 a 1000 caracteres");
        var p=scope();var d=lockedDocument(document,p);eligible(d,target,LocalDate.now());
        p.put("id",UUID.randomUUID());p.put("policy",d.get("policy_id"));p.put("months",d.get("retention_months"));p.put("due",d.get("eligible_on"));p.put("from",d.get("archive_level"));p.put("to",target);p.put("reason",reason.trim());
        var result=one("INSERT INTO document_transfers(id,tenant_id,document_id,policy_id,retention_months,eligible_on,from_level,to_level,reason,requested_by) VALUES(:id,:tenant,:document,:policy,:months,:due,:from,:to,:reason,:actor) RETURNING *",p);
        audit.record("TRANSFER_REQUESTED","DOCUMENTS",document,null,Map.of("transferId",p.get("id"),"from",p.get("from"),"to",target));return result;
    }
    public List<Map<String,Object>> transfers() {
        var rows=db.queryForList("SELECT x.*,d.name,d.code FROM document_transfers x JOIN documents d ON d.id=x.document_id AND d.tenant_id=x.tenant_id WHERE x.tenant_id=:tenant ORDER BY x.requested_at DESC,x.id LIMIT 500",scope());hide(rows);return rows;
    }
    public Map<String,Object> advance(UUID id,boolean execute) {
        var p=scope();p.put("id",id);
        var initial=one("SELECT document_id FROM document_transfers WHERE tenant_id=:tenant AND id=:id",p);
        var d=lockedDocument((UUID)initial.get("document_id"),p);
        var x=one("SELECT * FROM document_transfers WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);
        if(!(execute?"APPROVED":"REQUESTED").equals(x.get("status")))throw new IllegalStateException("La transferencia no esta en el estado requerido");
        eligible(d,x.get("to_level").toString(),LocalDate.now());
        if(!Objects.equals(d.get("archive_level"),x.get("from_level"))||!Objects.equals(d.get("policy_id"),x.get("policy_id"))||!Objects.equals(d.get("retention_months"),x.get("retention_months"))||!Objects.equals(d.get("eligible_on"),x.get("eligible_on")))throw new IllegalStateException("La politica o el periodo cambio desde la solicitud; no se puede ejecutar esta transferencia");
        p.put("to",x.get("to_level"));
        if(execute)db.update("UPDATE documents SET archive_level=:to,archive_level_since=current_date,updated_at=now() WHERE tenant_id=:tenant AND id=:document",p);
        var result=one(execute?"UPDATE document_transfers SET status='EXECUTED',executed_by=:actor,executed_at=now() WHERE tenant_id=:tenant AND id=:id RETURNING *":"UPDATE document_transfers SET status='APPROVED',approved_by=:actor,approved_at=now() WHERE tenant_id=:tenant AND id=:id RETURNING *",p);
        audit.record(execute?"TRANSFER_EXECUTED":"TRANSFER_APPROVED","DOCUMENTS",(UUID)initial.get("document_id"),Map.of("archiveLevel",x.get("from_level")),Map.of("transferId",id,"archiveLevel",execute?x.get("to_level"):x.get("from_level")));return result;
    }
}
