package com.lta.gestdocum.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class PhysicalArchiveService {
    private final DocumentOperations o;
    public PhysicalArchiveService(DocumentOperations o){this.o=o;}
    public Map<String,Object> options(){return o.internal("physical:read",()->{
        var p=o.args();var result=new LinkedHashMap<String,Object>();
        result.put("locations",o.db.queryForList("SELECT id,parent_id,name,active FROM physical_locations WHERE tenant_id=:tenant ORDER BY name",p));
        result.put("people",o.jdbc.queryForList("SELECT * FROM app.physical_people()"));
        result.put("documents",can("document:read")?o.db.queryForList("SELECT id,code,name FROM documents WHERE tenant_id=:tenant AND deleted_at IS NULL ORDER BY name LIMIT 100",p):List.of());
        result.put("expedients",can("expedient:read")?o.db.queryForList("SELECT id,code,name FROM expedients WHERE tenant_id=:tenant AND deleted_at IS NULL ORDER BY name LIMIT 100",p):List.of());
        return result;
    });}
    private boolean can(String permission){return Boolean.TRUE.equals(o.jdbc.queryForObject("SELECT app.has_permission(?)",Boolean.class,permission));}
    public Map<String,Object> location(UUID id,UUID parent,String name,boolean active){return o.internal("physical:manage",()->{
        o.jdbc.execute("SELECT pg_advisory_xact_lock(hashtextextended(current_setting('app.tenant_id'), 92))");
        var p=o.args("id",id==null?UUID.randomUUID():id,"parent",parent,"name",name.trim(),"active",active);
        if(parent!=null){
            o.one("SELECT id FROM physical_locations WHERE tenant_id=:tenant AND id=:parent AND active FOR UPDATE",p);
            if(id!=null && o.db.queryForObject("WITH RECURSIVE tree AS (SELECT id FROM physical_locations WHERE tenant_id=:tenant AND id=:id UNION ALL SELECT l.id FROM physical_locations l JOIN tree t ON l.parent_id=t.id WHERE l.tenant_id=:tenant) SELECT count(*) FROM tree WHERE id=:parent",p,Integer.class)>0)throw new IllegalArgumentException("Una ubicación no puede contenerse a sí misma");
        }
        if(id!=null&&!active && o.db.queryForObject("SELECT (SELECT count(*) FROM physical_items WHERE tenant_id=:tenant AND location_id=:id AND status<>'WITHDRAWN')+(SELECT count(*) FROM physical_locations WHERE tenant_id=:tenant AND parent_id=:id AND active)",p,Integer.class)>0)throw DocumentOperations.conflict("Traslada los originales y desactiva primero las ubicaciones hijas");
        var row=o.one(id==null?"INSERT INTO physical_locations(id,tenant_id,parent_id,name,active) VALUES(:id,:tenant,:parent,:name,:active) RETURNING *":"UPDATE physical_locations SET parent_id=:parent,name=:name,active=:active WHERE tenant_id=:tenant AND id=:id RETURNING *",p);
        o.audit(id==null?"PHYSICAL_LOCATION_CREATED":"PHYSICAL_LOCATION_UPDATED","PHYSICAL",(UUID)p.get("id"),Map.of("active",active));return row;
    });}
    public void deleteLocation(UUID id){o.internal("physical:manage",()->{
        var p=o.args("id",id);o.one("SELECT id FROM physical_locations WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);
        if(o.db.queryForObject("SELECT (SELECT count(*) FROM physical_items WHERE tenant_id=:tenant AND location_id=:id)+(SELECT count(*) FROM physical_locations WHERE tenant_id=:tenant AND parent_id=:id)",p,Integer.class)>0)throw DocumentOperations.conflict("Ubicación utilizada; puedes desactivarla cuando esté vacía");
        o.db.update("DELETE FROM physical_locations WHERE tenant_id=:tenant AND id=:id",p);o.audit("PHYSICAL_LOCATION_DELETED","PHYSICAL",id,Map.of());return null;
    });}
    public Map<String,Object> saveItem(UUID id,String code,String name,UUID location,UUID custodian,UUID document,UUID expedient,String condition,Integer revision){return o.internal("physical:manage",()->{
        var p=o.args("id",id==null?UUID.randomUUID():id,"code",code.trim(),"name",name.trim(),"location",location,"custodian",custodian,"document",document,"expedient",expedient,"condition",condition.trim());
        o.one("SELECT id FROM physical_locations WHERE tenant_id=:tenant AND id=:location AND active FOR UPDATE",p);
        if(document!=null)o.require("document:read");if(expedient!=null)o.require("expedient:read");
        if(id!=null){var old=item(id);if(!"AVAILABLE".equals(old.get("status")))throw DocumentOperations.conflict("Solo se edita una unidad disponible");if(!Objects.equals(revision,old.get("revision")))throw DocumentOperations.conflict("La ficha cambió; recarga antes de guardar");}
        var row=o.one(id==null?"INSERT INTO physical_items(id,tenant_id,code,name,location_id,custodian_id,document_id,expedient_id,condition) VALUES(:id,:tenant,:code,:name,:location,:custodian,:document,:expedient,:condition) RETURNING *":"UPDATE physical_items SET code=:code,name=:name,location_id=:location,custodian_id=:custodian,document_id=:document,expedient_id=:expedient,condition=:condition,revision=revision+1,updated_at=now() WHERE tenant_id=:tenant AND id=:id RETURNING *",p);
        movement((UUID)p.get("id"),null,id==null?"REGISTERED":"UPDATED",Map.of("locationId",location,"custodianId",custodian));return row;
    });}
    public Map<String,Object> list(String search,String status,int page,int size){return o.internal("physical:read",()->{
        var p=o.args("search","%"+search.trim()+"%","status",status==null?"":status,"limit",Math.max(1,Math.min(size,100)),"offset",Math.max(0,page)*Math.max(1,Math.min(size,100)));
        String filter=" FROM physical_items i JOIN physical_locations l ON l.tenant_id=i.tenant_id AND l.id=i.location_id WHERE i.tenant_id=:tenant AND (i.code ILIKE :search OR i.name ILIKE :search) AND (:status='' OR i.status=:status)";
        var rows=o.db.queryForList("SELECT i.*,l.name AS location_name"+filter+" ORDER BY i.created_at DESC,i.id LIMIT :limit OFFSET :offset",p);
        return Map.of("content",rows,"totalElements",o.db.queryForObject("SELECT count(*)"+filter,p,Long.class),"page",Math.max(0,page));
    });}
    public Map<String,Object> detail(UUID id){return o.internal("physical:read",()->{
        var p=o.args("id",id);var row=new LinkedHashMap<>(o.one("SELECT * FROM physical_items WHERE tenant_id=:tenant AND id=:id",p));
        row.put("loans",o.db.queryForList("SELECT l.*,p.display_name AS requester_name,(l.status='HANDED_OVER' AND l.due_at<now()) AS overdue FROM physical_loans l LEFT JOIN app.physical_people() p ON p.id=l.requested_by WHERE l.tenant_id=:tenant AND l.item_id=:id ORDER BY l.created_at DESC LIMIT 100",p));
        row.put("movements",o.db.queryForList("SELECT id,loan_id,actor_id,action,details,created_at FROM physical_movements WHERE tenant_id=:tenant AND item_id=:id ORDER BY created_at DESC LIMIT 200",p));return row;
    });}
    private Map<String,Object> item(UUID id){return o.one("SELECT * FROM physical_items WHERE tenant_id=:tenant AND id=:id FOR UPDATE",o.args("id",id));}
    private void custodian(Map<String,Object> item){if(!o.context.requireUserId().equals(item.get("custodian_id"))&&!can("physical:manage"))throw new AccessDeniedException("Solo el custodio asignado puede confirmar este movimiento");}
    private void movement(UUID item,UUID loan,String action,Map<String,Object> details){
        var p=o.args("item",item,"loan",loan,"action",action,"details",o.encode(details));
        o.db.update("INSERT INTO physical_movements(tenant_id,item_id,loan_id,actor_id,action,details) VALUES(:tenant,:item,:loan,:actor,:action,cast(:details AS jsonb))",p);
        o.audit("PHYSICAL_"+action,"PHYSICAL",item,Map.of("loanId",loan==null?"":loan.toString(),"movement",action));
    }
    public Map<String,Object> request(UUID id,String reason,OffsetDateTime due){return o.internal("physical:request",()->{
        var i=item(id);if(!"AVAILABLE".equals(i.get("status")))throw DocumentOperations.conflict("El original no está disponible");
        if(!due.isAfter(OffsetDateTime.now())||due.isAfter(OffsetDateTime.now().plusDays(90)))throw new IllegalArgumentException("Devolución requerida dentro de los próximos 90 días");
        var p=o.args("id",UUID.randomUUID(),"item",id,"reason",reason.trim(),"due",due);
        if(o.db.queryForObject("SELECT count(*) FROM physical_loans WHERE tenant_id=:tenant AND item_id=:item AND requested_by=:actor AND status='REQUESTED'",p,Integer.class)>0)throw DocumentOperations.conflict("Ya tienes una solicitud pendiente");
        var row=o.one("INSERT INTO physical_loans(id,tenant_id,item_id,requested_by,reason,due_at) VALUES(:id,:tenant,:item,:actor,:reason,:due) RETURNING *",p);movement(id,(UUID)p.get("id"),"REQUESTED",Map.of("dueAt",due.toString()));o.jdbc.queryForObject("SELECT app.physical_loan_notice(?,'REQUESTED')",Object.class,p.get("id"));return row;
    });}
    public Map<String,Object> action(UUID loan,String action,String reason,UUID location,String condition,boolean incident){
        String permission=switch(action){case "reserve","reject"->"physical:approve";case "handover"->"physical:handover";case "return"->"physical:return";case "cancel"->"physical:request";default->throw new IllegalArgumentException("Acción inválida");};
        return o.internal(permission,()->{
            var p=o.args("id",loan,"reason",reason==null?"":reason.trim(),"location",location,"condition",condition==null?"":condition.trim());
            var first=o.one("SELECT item_id FROM physical_loans WHERE tenant_id=:tenant AND id=:id",p);UUID itemId=(UUID)first.get("item_id");var i=item(itemId);p.put("item",itemId);
            var l=o.one("SELECT * FROM physical_loans WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);String state=l.get("status").toString();
            if(!action.equals("cancel"))custodian(i);
            switch(action){
                case "reserve"->{
                    if(!"REQUESTED".equals(state)||!"AVAILABLE".equals(i.get("status")))throw DocumentOperations.conflict("La unidad ya no puede reservarse");
                    if(!time(l.get("due_at")).isAfter(OffsetDateTime.now()))throw DocumentOperations.conflict("La fecha de devolución ya venció; solicita de nuevo");
                    o.db.update("UPDATE physical_loans SET status='RESERVED',approved_by=:actor,reserved_until=least(now()+interval '24 hours',due_at) WHERE tenant_id=:tenant AND id=:id",p);setItem(p,"RESERVED");
                }
                case "reject"->{if(!"REQUESTED".equals(state))throw DocumentOperations.conflict("Solo se rechaza una solicitud pendiente");reason(reason);o.db.update("UPDATE physical_loans SET status='REJECTED',approved_by=:actor,decision_reason=:reason WHERE tenant_id=:tenant AND id=:id",p);}
                case "cancel"->{if(!o.context.requireUserId().equals(l.get("requested_by"))&&!can("physical:manage"))throw new AccessDeniedException("No puedes cancelar esta solicitud");if(!Set.of("REQUESTED","RESERVED").contains(state))throw DocumentOperations.conflict("La solicitud no puede cancelarse");reason(reason);o.db.update("UPDATE physical_loans SET status='CANCELLED',decision_reason=:reason WHERE tenant_id=:tenant AND id=:id",p);if(state.equals("RESERVED"))setItem(p,"AVAILABLE");}
                case "handover"->{
                    if(!"RESERVED".equals(state)||!"RESERVED".equals(i.get("status"))||!time(l.get("reserved_until")).isAfter(OffsetDateTime.now()))throw DocumentOperations.conflict("Reserva vencida o no disponible");
                    if(o.db.queryForObject("SELECT count(*) FROM app.physical_people() WHERE id=:requester",Map.of("requester",l.get("requested_by")),Integer.class)!=1)throw DocumentOperations.conflict("El receptor no está activo");
                    reason(condition);o.db.update("UPDATE physical_loans SET status='HANDED_OVER',handed_by=:actor,handed_at=now() WHERE tenant_id=:tenant AND id=:id",p);setItem(p,"ON_LOAN");
                }
                case "return"->{
                    if(!"HANDED_OVER".equals(state)||!"ON_LOAN".equals(i.get("status")))throw DocumentOperations.conflict("No hay préstamo entregado para devolver");reason(condition);if(location==null)throw new IllegalArgumentException("Selecciona ubicación de retorno");o.one("SELECT id FROM physical_locations WHERE tenant_id=:tenant AND id=:location AND active FOR UPDATE",p);
                    o.db.update("UPDATE physical_loans SET status='RETURNED',returned_by=:actor,returned_at=now(),return_condition=:condition WHERE tenant_id=:tenant AND id=:id",p);setItem(p,incident?"INCIDENT":"AVAILABLE");
                    o.db.update("UPDATE physical_items SET location_id=:location,condition=:condition WHERE tenant_id=:tenant AND id=:item",p);
                }
            }
            movement(itemId,loan,action.toUpperCase(Locale.ROOT),Map.of("condition",p.get("condition"),"reason",p.get("reason"),"incident",incident));if(action.equals("reserve"))o.jdbc.queryForObject("SELECT app.physical_loan_notice(?,'RESERVED')",Object.class,loan);return o.one("SELECT * FROM physical_loans WHERE tenant_id=:tenant AND id=:id",p);
        });
    }
    public Map<String,Object> resolve(UUID id,String reason){return o.internal("physical:return",()->{var i=item(id);custodian(i);if(!Set.of("INCIDENT","RECONCILIATION_REQUIRED").contains(i.get("status")))throw DocumentOperations.conflict("La unidad no tiene una incidencia");reason(reason);var p=o.args("item",id);setItem(p,"AVAILABLE");movement(id,null,"RECONCILED",Map.of("reason",reason));return item(id);});}
    public Map<String,Object> withdraw(UUID id,String reason){return o.internal("physical:manage",()->{var i=item(id);if(!"AVAILABLE".equals(i.get("status")))throw DocumentOperations.conflict("Solo se retira una unidad disponible");reason(reason);setItem(o.args("item",id),"WITHDRAWN");movement(id,null,"WITHDRAWN",Map.of("reason",reason));return item(id);});}
    private void setItem(Map<String,Object> p,String status){p.put("status",status);o.db.update("UPDATE physical_items SET status=:status,revision=revision+1,updated_at=now() WHERE tenant_id=:tenant AND id=:item",p);}
    private static void reason(String reason){if(reason==null||reason.trim().length()<5||reason.trim().length()>1000)throw new IllegalArgumentException("Indica un motivo o condición de 5 a 1000 caracteres");}
    public static OffsetDateTime time(Object value){if(value instanceof OffsetDateTime t)return t;if(value instanceof java.sql.Timestamp t)return t.toInstant().atOffset(java.time.ZoneOffset.UTC);throw new IllegalArgumentException("Fecha no disponible");}
    void maintenance(){
        // Same lock order as interactive transitions: item first, loan second.
        var ids=o.db.queryForList("SELECT DISTINCT item_id FROM physical_loans WHERE tenant_id=:tenant AND ((status='RESERVED' AND reserved_until<=now()) OR (status='HANDED_OVER' AND due_at<now() AND reminder_date IS DISTINCT FROM current_date)) LIMIT 20",o.args());
        for(var value:ids){UUID itemId=(UUID)value.get("item_id");item(itemId);var p=o.args("item",itemId);
            var loans=o.db.queryForList("SELECT id,status FROM physical_loans WHERE tenant_id=:tenant AND item_id=:item AND ((status='RESERVED' AND reserved_until<=now()) OR (status='HANDED_OVER' AND due_at<now() AND reminder_date IS DISTINCT FROM current_date)) FOR UPDATE",p);
            for(var l:loans){p.put("id",l.get("id"));if("RESERVED".equals(l.get("status"))){o.db.update("UPDATE physical_loans SET status='CANCELLED',decision_reason='Reserva vencida sin recogida' WHERE tenant_id=:tenant AND id=:id",p);setItem(p,"AVAILABLE");movement(itemId,(UUID)l.get("id"),"RESERVATION_EXPIRED",Map.of());}
                else{o.jdbc.queryForObject("SELECT app.physical_loan_notice(?,'OVERDUE')",Object.class,l.get("id"));o.db.update("UPDATE physical_loans SET reminder_date=current_date WHERE tenant_id=:tenant AND id=:id",p);}
            }
        }
    }
}
