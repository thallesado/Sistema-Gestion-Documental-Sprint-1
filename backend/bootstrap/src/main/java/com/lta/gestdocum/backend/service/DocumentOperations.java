package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.*;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.util.function.Supplier;
import java.util.function.Consumer;

/** One explicit routing scope and application role per transaction, also for background work. */
@Component
public class DocumentOperations {
    public final NamedParameterJdbcTemplate db;
    public final JdbcTemplate jdbc;
    public final ObjectMapper json;
    public final AuthenticatedUserContext context;
    private final TransactionTemplate tx;
    public DocumentOperations(NamedParameterJdbcTemplate db, JdbcTemplate jdbc, ObjectMapper json,
                              AuthenticatedUserContext context, PlatformTransactionManager manager) {
        this.db=db;this.jdbc=jdbc;this.json=json;this.context=context;
        tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public <T> T internal(String permission,Supplier<T> work) { return as(context.require(),permission,work); }
    public <T> T as(AuthenticatedUser user,String permission,Supplier<T> work) {
        if(user.tenantId()==null)throw new AccessDeniedException("Se requiere una organización");
        var previous=SecurityContextHolder.getContext();
        var auth=SecurityContextHolder.createEmptyContext();
        auth.setAuthentication(new UsernamePasswordAuthenticationToken(user,null,user.authorities().stream().map(SimpleGrantedAuthority::new).toList()));
        try(var scope=TenantDatabaseContext.useTenant(user.tenantId())) {
            SecurityContextHolder.setContext(auth);
            return tx.execute(status->{
                jdbc.execute("SET LOCAL ROLE nexodocs_app");
                jdbc.queryForObject("SELECT set_config('app.tenant_id',?,true)",String.class,user.tenantId().toString());
                jdbc.queryForObject("SELECT set_config('app.user_id',?,true)",String.class,user.userId().toString());
                require(permission);return work.get();
            });
        } finally { SecurityContextHolder.setContext(previous); }
    }
    public <T> T external(UUID tenant,Supplier<T> work) {
        try(var scope=TenantDatabaseContext.useTenant(tenant)) {
            return tx.execute(status->{jdbc.execute("SET LOCAL ROLE nexodocs_app");return work.get();});
        }
    }
    public void require(String permission) {
        if(!context.hasAuthority(permission)||!Boolean.TRUE.equals(jdbc.queryForObject("SELECT app.has_permission(?)",Boolean.class,permission)))
            throw new AccessDeniedException("Permiso requerido: "+permission);
    }
    public Map<String,Object> args(Object... values) {
        var p=new HashMap<String,Object>();p.put("tenant",context.requireTenantId());p.put("actor",context.requireUserId());
        for(int i=0;i<values.length;i+=2)p.put((String)values[i],values[i+1]);return p;
    }
    public Map<String,Object> one(String sql,Map<String,?> p) {
        var rows=db.queryForList(sql,p);if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Registro no disponible");return rows.getFirst();
    }
    public String encode(Object value) {try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("Datos no serializables");}}
    public void audit(String action,String entity,UUID id,Map<String,Object> detail) {
        jdbc.update("INSERT INTO audit_events(tenant_id,user_id,action,entity_type,entity_id,result,details) VALUES(?,?,?,?,?,'SUCCESS',?::jsonb)",context.requireTenantId(),context.requireUserId(),action,entity,id,encode(detail));
    }
    public static ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
    public void background(String permission,Consumer<AuthenticatedUser> work) {
        List<UUID> tenants;
        try(var scope=TenantDatabaseContext.useControl()){
            tenants=jdbc.queryForList("SELECT tenant_id FROM app.tenant_database_registry WHERE lifecycle_state IN('LEGACY_SHARED','TRIAL','ACTIVE') ORDER BY tenant_id",UUID.class);
        }
        for(UUID tenant:tenants)try(var scope=TenantDatabaseContext.useTenant(tenant)){
            UUID actor=tx.execute(status->{jdbc.execute("SET LOCAL ROLE nexodocs_app");jdbc.queryForObject("SELECT set_config('app.tenant_id',?,true)",String.class,tenant.toString());return jdbc.queryForObject("SELECT app.document_operations_actor(?,?)",UUID.class,tenant,permission);});
            if(actor!=null)work.accept(new AuthenticatedUser(actor,tenant,"document-operations",Set.of(permission)));
        }catch(RuntimeException ex){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Document operations worker tenant={} permission={} failure={}",tenant,permission,ex.getClass().getSimpleName());}
    }
}
