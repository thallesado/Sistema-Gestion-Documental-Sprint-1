package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import java.util.zip.*;

/** Local tenant recovery. Packages and pinned evidence live on the existing storage volume. */
@Service
public class TenantBackupService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final AuthenticatedUserContext context;
    private final TransactionTemplate transaction;
    private final Path root;
    private final ExecutorService jobs = Executors.newFixedThreadPool(2, r -> { Thread t = new Thread(r,"tenant-backup"); t.setDaemon(true); return t; });

    public TenantBackupService(JdbcTemplate jdbc, ObjectMapper json, AuthenticatedUserContext context,
                               PlatformTransactionManager manager, @Value("${app.storage.local-path:./data/storage}") String root) {
        this.jdbc=jdbc; this.json=json; this.context=context; this.root=Path.of(root).toAbsolutePath().normalize();
        transaction=new TransactionTemplate(manager); transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    @PreDestroy void close() { jobs.shutdown(); }
    @FunctionalInterface private interface Work<T> { T get() throws Exception; }
    private <T> T tx(AuthenticatedUser user, String permission, Work<T> body) {
        return transaction.execute(status -> {
            jdbc.queryForObject("SELECT set_config('app.tenant_id',?,true)",String.class,user.tenantId().toString());
            jdbc.queryForObject("SELECT set_config('app.user_id',?,true)",String.class,user.userId().toString());
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT app.has_permission(?)",Boolean.class,permission))) throw new AccessDeniedException("Sin permiso de respaldos");
            try { return body.get(); } catch(RuntimeException e) { throw e; } catch(Exception e) { throw new IllegalStateException("Operación de respaldo fallida",e); }
        });
    }
    private AuthenticatedUser user() { context.requireTenantId(); return context.require(); }
    private Map<String,Object> record(UUID tenant,UUID id) {
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT id,origin,status,created_at,completed_at,file_size_bytes,checksum,error_message,pinned FROM tenant_backups WHERE tenant_id=? AND id=?",tenant,id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Respaldo no encontrado");
        return rows.get(0);
    }
    public Map<String,Object> overview() {
        AuthenticatedUser u=user();
        return tx(u,"backup:read",()-> {
            Map<String,Object> result=new LinkedHashMap<>();
            result.put("backups",jdbc.queryForList("SELECT b.id,b.origin,b.status,b.created_at,b.completed_at,b.file_size_bytes,b.checksum,b.error_message,b.pinned,coalesce(u.first_name||' '||u.last_name,'Sistema') AS creator FROM tenant_backups b LEFT JOIN users u ON u.id=b.created_by AND u.tenant_id=b.tenant_id WHERE b.tenant_id=? ORDER BY b.created_at DESC LIMIT 500",u.tenantId()));
            result.put("settings",settings(u.tenantId()));
            result.put("operations",jdbc.queryForList("SELECT id,backup_id,safety_backup_id,status,stage,created_at,completed_at,error_message FROM tenant_restore_operations WHERE tenant_id=? ORDER BY created_at DESC LIMIT 20",u.tenantId()));
            result.put("permissions",jdbc.queryForList("SELECT code FROM permissions WHERE module='backup' AND app.has_permission(code)",String.class));
            return result;
        });
    }
    private Map<String,Object> settings(UUID tenant) {
        jdbc.update("INSERT INTO tenant_backup_settings(tenant_id) VALUES(?) ON CONFLICT DO NOTHING",tenant);
        Map<String,Object> s=new LinkedHashMap<>(jdbc.queryForMap("SELECT enabled,daily_time::text,timezone,retention_days,last_run_date FROM tenant_backup_settings WHERE tenant_id=?",tenant));
        if(Boolean.TRUE.equals(s.get("enabled"))) {
            ZonedDateTime now=ZonedDateTime.now(ZoneId.of(s.get("timezone").toString()));
            ZonedDateTime next=now.toLocalDate().atTime(LocalTime.parse(s.get("daily_time").toString())).atZone(now.getZone());
            if(!next.isAfter(now)) next=next.plusDays(1);
            s.put("next_run",next.toOffsetDateTime().toString());
        } else s.put("next_run",null);
        return s;
    }
    public Map<String,Object> configure(boolean enabled,String time,String zone,int retention) {
        try { LocalTime.parse(time); ZoneId.of(zone); } catch(DateTimeException e) { throw new IllegalArgumentException("Horario o zona horaria inválidos"); }
        if(retention<1||retention>365) throw new IllegalArgumentException("Retención entre 1 y 365 días");
        AuthenticatedUser u=user();
        return tx(u,"backup:configure",()-> {
            jdbc.update("INSERT INTO tenant_backup_settings(tenant_id,enabled,daily_time,timezone,retention_days) VALUES(?,?,?::time,?,?) ON CONFLICT(tenant_id) DO UPDATE SET enabled=excluded.enabled,daily_time=excluded.daily_time,timezone=excluded.timezone,retention_days=excluded.retention_days,updated_at=now()",u.tenantId(),enabled,time,zone,retention);
            audit(u,"BACKUP_SETTINGS_UPDATED",u.tenantId(),Map.of("enabled",enabled,"hour",time,"timezone",zone,"retentionDays",retention));
            return settings(u.tenantId());
        });
    }
    public Map<String,Object> create() {
        AuthenticatedUser u=user(); UUID id=reserve(u,"MANUAL",false);
        jobs.submit(()->generate(u,id)); return Map.of("id",id,"status","RUNNING");
    }
    private UUID reserve(AuthenticatedUser u,String origin,boolean pinned) {
        return tx(u,"backup:create",()-> {
            jdbc.queryForObject("SELECT pg_advisory_xact_lock(726397,hashtext(?))",Object.class,u.tenantId().toString());
            if(!origin.equals("SAFETY") && (jdbc.queryForObject("SELECT count(*) FROM tenant_backups WHERE tenant_id=? AND status='RUNNING'",Integer.class,u.tenantId())>0 || jdbc.queryForObject("SELECT count(*) FROM tenant_restore_operations WHERE tenant_id=? AND status='RUNNING'",Integer.class,u.tenantId())>0)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Ya hay una operación en curso");
            UUID id=UUID.randomUUID();
            jdbc.update("INSERT INTO tenant_backups(id,tenant_id,created_by,origin,status,pinned) VALUES(?,?,?,?,'RUNNING',?)",id,u.tenantId(),u.userId(),origin,pinned);
            audit(u,"BACKUP_STARTED",id,Map.of("origin",origin)); return id;
        });
    }
    private void generate(AuthenticatedUser u,UUID id) {
        try { tx(u,"backup:create",()-> {
            // This lock also covers filesystem capture; all tenant table writers participate.
            jdbc.queryForObject("SELECT pg_advisory_xact_lock(726396,hashtext(?))",Object.class,u.tenantId().toString());
            String payload=jdbc.queryForObject("SELECT app.capture_tenant_backup(?)::text",String.class,u.tenantId());
            String schema=jdbc.queryForObject("SELECT app.backup_schema_signature()",String.class);
            Path target=packagePath(u.tenantId(),id); Files.createDirectories(target.getParent());
            if(Files.getFileStore(target.getParent()).supportsFileAttributeView("posix")) {
                Files.setPosixFilePermissions(root.resolve(".backups"),java.nio.file.attribute.PosixFilePermissions.fromString("rwx------"));
                Files.setPosixFilePermissions(target.getParent(),java.nio.file.attribute.PosixFilePermissions.fromString("rwx------"));
            }
            Path temp=target.resolveSibling(id+".tmp");
            Map<String,String> files=new TreeMap<>();
            JsonNode data=json.readTree(payload); Set<String> references=new HashSet<>(); collectReferences(data,references);
            for(Path dir:List.of(root.resolve(u.tenantId().toString()),root.resolve("ocr").resolve(u.tenantId().toString()))) {
                if(Files.exists(dir)) try(var walk=Files.walk(dir)) { for(Path p:walk.filter(p->Files.isRegularFile(p,LinkOption.NOFOLLOW_LINKS)).toList()) {
                    if(p.toString().endsWith(".uploading")) continue;
                    String relative=root.relativize(p).toString().replace('\\','/');
                    safeFile(u.tenantId(),relative); files.put(relative,sha(p));
                }}
            }
            for(String reference:references) {Path file=backupFile(u.tenantId(),reference,references); if(!Files.isRegularFile(file))throw new IllegalStateException("Falta archivo asociado"); files.put(reference,sha(file));}
            requireReferencedFiles(data,files);
            Map<String,Object> manifest=new LinkedHashMap<>();manifest.put("format",1);manifest.put("tenantId",u.tenantId().toString());manifest.put("backupId",id.toString());manifest.put("capturedAt",Instant.now().toString());manifest.put("schema",schema);manifest.put("files",files);manifest.put("snapshotSha256",sha(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            try(ZipOutputStream zip=new ZipOutputStream(Files.newOutputStream(temp))) {
                entry(zip,"snapshot.json",payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                entry(zip,"manifest.json",json.writeValueAsBytes(manifest));
                for(String file:files.keySet()) {zip.putNextEntry(new ZipEntry("files/"+file));Files.copy(backupFile(u.tenantId(),file,references),zip);zip.closeEntry();}
            }
            Files.move(temp,target,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
            if(Files.getFileStore(target).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(target,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            jdbc.update("UPDATE tenant_backups SET status='COMPLETED',completed_at=now(),file_path=?,file_size_bytes=?,checksum=?,schema_signature=?,payload=?::jsonb WHERE id=? AND tenant_id=?",root.relativize(target).toString(),Files.size(target),sha(target),schema,payload,id,u.tenantId());
            audit(u,"BACKUP_COMPLETED",id,Map.of("files",files.size(),"checksum",sha(target)));return null;
        }); } catch(Exception error) { try {Files.deleteIfExists(packagePath(u.tenantId(),id).resolveSibling(id+".tmp"));}catch(IOException ignored){} failure(u,id,null,"No se pudo completar el respaldo: "+diagnostic(error)); }
    }
    private void requireReferencedFiles(JsonNode node,Map<String,String> files) {
        if(node.isObject()) {node.fields().forEachRemaining(e->{if(Set.of("file_path","original_file_path").contains(e.getKey())&&e.getValue().isTextual()&&!e.getValue().asText().isBlank()&&!files.containsKey(e.getValue().asText().replace('\\','/'))) throw new IllegalStateException("Falta archivo asociado");requireReferencedFiles(e.getValue(),files);});}
        else if(node.isArray()) node.forEach(n->requireReferencedFiles(n,files));
    }
    private void collectReferences(JsonNode node,Set<String> files) {
        if(node.isObject())node.fields().forEachRemaining(e->{if(Set.of("file_path","original_file_path").contains(e.getKey())&&e.getValue().isTextual()&&!e.getValue().asText().isBlank())files.add(e.getValue().asText().replace('\\','/'));collectReferences(e.getValue(),files);});else if(node.isArray())node.forEach(n->collectReferences(n,files));
    }
    private Path backupFile(UUID tenant,String relative,Set<String> references) {
        if(relative.startsWith("synthetic/")&&references.contains(relative)) {
            Path path=root.resolve(relative).normalize();if(!path.startsWith(root.resolve("synthetic")))throw new IllegalArgumentException("Ruta heredada inválida");
            for(Path p=path;p!=null&&p.startsWith(root);p=p.getParent())if(Files.isSymbolicLink(p))throw new IllegalArgumentException("Enlace simbólico no permitido");
            if(jdbc.queryForObject("SELECT count(*) FROM document_versions WHERE file_path=? AND tenant_id<>?",Integer.class,relative,tenant)>0)throw new IllegalArgumentException("Archivo compartido entre tenants");
            return path;
        }
        return safeFile(tenant,relative);
    }
    public Map<String,Object> verify(UUID id) {AuthenticatedUser u=user();return tx(u,"backup:read",()->verify(u,id,false));}
    private Map<String,Object> verify(AuthenticatedUser u,UUID id,boolean prepare) {
        Map<String,Object> row=record(u.tenantId(),id);
        if(!"COMPLETED".equals(row.get("status"))) return Map.of("valid",false,"compatible",false,"message","Respaldo no disponible");
        try(ZipFile zip=new ZipFile(packagePath(u.tenantId(),id).toFile())) {
            if(!Objects.equals(row.get("checksum"),sha(packagePath(u.tenantId(),id)))) throw new IOException("Checksum inválido");
            JsonNode manifest=json.readTree(zip.getInputStream(zip.getEntry("manifest.json")));
            if(!u.tenantId().toString().equals(manifest.path("tenantId").asText())||!id.toString().equals(manifest.path("backupId").asText())) throw new IOException("Identidad inválida");
            byte[] snapshot=zip.getInputStream(zip.getEntry("snapshot.json")).readAllBytes();
            if(!sha(snapshot).equals(manifest.path("snapshotSha256").asText())) throw new IOException("Datos alterados");
            String stored=jdbc.queryForObject("SELECT payload::text FROM tenant_backups WHERE id=? AND tenant_id=?",String.class,id,u.tenantId());
            if(!json.readTree(stored).equals(json.readTree(snapshot))) throw new IOException("Datos divergentes");
            Set<String> references=new HashSet<>();collectReferences(json.readTree(snapshot),references);
            var it=manifest.path("files").fields();int count=0;
            while(it.hasNext()) {var e=it.next();Path file=backupFile(u.tenantId(),e.getKey(),references);ZipEntry item=zip.getEntry("files/"+e.getKey());if(item==null)throw new IOException("Archivo ausente");
                try(InputStream in=zip.getInputStream(item)){if(!sha(in).equals(e.getValue().asText()))throw new IOException("Archivo alterado");}
                if(prepare) {
                    if(Files.exists(file)&&!sha(file).equals(e.getValue().asText())) throw new IOException("Ruta documental existente con contenido diferente");
                    if(!Files.exists(file)){Files.createDirectories(file.getParent());Path temp=Files.createTempFile(file.getParent(),"restore-",".tmp");try(InputStream in=zip.getInputStream(item)){Files.copy(in,temp,StandardCopyOption.REPLACE_EXISTING);}Files.move(temp,file,StandardCopyOption.ATOMIC_MOVE);}
                } count++;
            }
            boolean compatible=Objects.equals(manifest.path("schema").asText(),jdbc.queryForObject("SELECT app.backup_schema_signature()",String.class));
            return Map.of("valid",true,"compatible",compatible,"files",count,"message",compatible?"Integridad válida y esquema compatible":"Formato de esquema incompatible");
        }catch(Exception error){return Map.of("valid",false,"compatible",false,"message","El paquete está incompleto, alterado o sus archivos no se pueden preparar");}
    }
    public Path download(UUID id) {AuthenticatedUser u=user();return tx(u,"backup:download",()->{if(!Boolean.TRUE.equals(verify(u,id,false).get("valid")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Respaldo no válido");audit(u,"BACKUP_DOWNLOADED",id,Map.of());return packagePath(u.tenantId(),id);});}
    public Map<String,Object> restore(UUID id,String name) {
        AuthenticatedUser u=user(); UUID op=tx(u,"backup:restore",()-> {
            jdbc.queryForObject("SELECT pg_advisory_xact_lock(726397,hashtext(?))",Object.class,u.tenantId().toString());
            if(jdbc.queryForObject("SELECT count(*) FROM tenant_backups WHERE tenant_id=? AND status='RUNNING'",Integer.class,u.tenantId())>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Ya hay un respaldo en curso");
            String expected=jdbc.queryForObject("SELECT name FROM tenants WHERE id=?",String.class,u.tenantId());
            if(!Objects.equals(name,expected))throw new IllegalArgumentException("El nombre de organización no coincide");
            Map<String,Object> check=verify(u,id,false);if(!Boolean.TRUE.equals(check.get("valid"))||!Boolean.TRUE.equals(check.get("compatible")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Respaldo inválido o incompatible");
            UUID operation=UUID.randomUUID();if(jdbc.update("UPDATE tenant_backups SET pinned=true WHERE id=? AND tenant_id=? AND status='COMPLETED'",id,u.tenantId())!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"El respaldo ya no está disponible");jdbc.update("INSERT INTO tenant_restore_operations(id,tenant_id,backup_id,created_by) VALUES(?,?,?,?)",operation,u.tenantId(),id,u.userId());audit(u,"RESTORE_STARTED",id,Map.of("operationId",operation));return operation;
        });
        jobs.submit(()->runRestore(u,id,op));return Map.of("id",op,"status","RUNNING");
    }
    private void runRestore(AuthenticatedUser u,UUID id,UUID op) {
        try {
            stage(u,op,"SAFETY"); UUID safety=reserve(u,"SAFETY",true);generate(u,safety);
            tx(u,"backup:restore",()->{if(!"COMPLETED".equals(record(u.tenantId(),safety).get("status")))throw new IllegalStateException("Respaldo de seguridad fallido");jdbc.update("UPDATE tenant_restore_operations SET safety_backup_id=? WHERE id=? AND tenant_id=?",safety,op,u.tenantId());return null;});
            stage(u,op,"PREPARING");
            tx(u,"backup:restore",()->{Map<String,Object> check=verify(u,id,true);if(!Boolean.TRUE.equals(check.get("valid"))||!Boolean.TRUE.equals(check.get("compatible")))throw new IllegalStateException("No se pudieron preparar los archivos");return null;});
            stage(u,op,"RESTORING");
            tx(u,"backup:restore",()->{jdbc.queryForObject("SELECT app.restore_tenant_backup(?)",Object.class,op);audit(u,"RESTORE_COMPLETED",id,Map.of("operationId",op,"safetyBackupId",safety));return null;});
        }catch(Exception error){failure(u,null,op,"La restauración no se completó; la transacción no se confirmó. "+diagnostic(error));}
    }
    private String diagnostic(Exception error){Throwable cause=error;while(cause.getCause()!=null)cause=cause.getCause();if(cause instanceof java.sql.SQLException sql)return "Error de base de datos ("+sql.getSQLState()+")";if("Falta archivo asociado".equals(cause.getMessage()))return "Faltan archivos asociados en el almacenamiento";return cause.getClass().getSimpleName();}
    private void stage(AuthenticatedUser u,UUID op,String stage){tx(u,"backup:restore",()->{jdbc.update("UPDATE tenant_restore_operations SET stage=? WHERE id=? AND tenant_id=?",stage,op,u.tenantId());return null;});}
    private void failure(AuthenticatedUser u,UUID backup,UUID operation,String message) {
        // Operational record and audit remain outside the rolled-back data transaction.
        transaction.execute(status->{if(backup!=null)jdbc.update("UPDATE tenant_backups SET status='FAILED',completed_at=now(),error_message=? WHERE id=? AND tenant_id=?",message,backup,u.tenantId());if(operation!=null)jdbc.update("UPDATE tenant_restore_operations SET status='FAILED',stage='FAILED',completed_at=now(),error_message=? WHERE id=? AND tenant_id=? AND status='RUNNING'",message,operation,u.tenantId());audit(u,operation==null?"BACKUP_FAILED":"RESTORE_FAILED",operation==null?backup:operation,Map.of());return null;});
    }
    private void audit(AuthenticatedUser u,String action,UUID id,Map<String,Object> details) {
        try{jdbc.update("INSERT INTO audit_events(tenant_id,user_id,action,entity_type,entity_id,result,details) VALUES(?,?,?,'BACKUP',?, ?,?::jsonb)",u.tenantId(),u.userId(),action,id,action.endsWith("FAILED")?"FAILURE":"SUCCESS",json.writeValueAsString(details));}catch(IOException e){throw new UncheckedIOException(e);}
    }
    Path safeFile(UUID tenant,String relative) {
        Path path=root.resolve(relative).normalize();
        if(!path.startsWith(root.resolve(tenant.toString()))&&!path.startsWith(root.resolve("ocr").resolve(tenant.toString())))throw new IllegalArgumentException("Archivo fuera del tenant");
        for(Path p=path;p!=null&&p.startsWith(root);p=p.getParent())if(Files.isSymbolicLink(p))throw new IllegalArgumentException("Enlaces simbólicos no permitidos");
        return path;
    }
    private Path packagePath(UUID tenant,UUID id){return root.resolve(".backups").resolve(tenant.toString()).resolve(id+".zip");}

    public Map<String,Object> evidence(UUID id,String table,String rowId) {
        if(!Set.of("documents","document_versions","workflow_events","workflow_comments","medical_notes","clinical_history_revisions","workflow_approvals").contains(table))throw new IllegalArgumentException("Tipo de evidencia no permitido");
        AuthenticatedUser u=user();return tx(u,"backup:download",()->{
            if(!Boolean.TRUE.equals(record(u.tenantId(),id).get("pinned")))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Este respaldo no contiene evidencia protegida");
            String payload=jdbc.queryForObject("SELECT payload::text FROM tenant_backups WHERE id=? AND tenant_id=? AND pinned AND status='COMPLETED'",String.class,id,u.tenantId());
            for(JsonNode row:json.readTree(payload).path(table)) if(rowId.equals(row.path("id").asText())) {audit(u,"BACKUP_EVIDENCE_READ",id,Map.of("table",table,"rowId",rowId));return json.convertValue(row,new TypeReference<Map<String,Object>>(){});}
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Evidencia no encontrada en este respaldo");
        });
    }

    public Map<String,Object> maintenance() {
        UUID tenant=context.requireTenantId();
        var rows=jdbc.queryForList("SELECT id,status,stage FROM tenant_restore_operations WHERE tenant_id=? AND status='RUNNING' ORDER BY created_at DESC LIMIT 1",tenant);
        return rows.isEmpty()?Map.of("restoring",false):Map.of("restoring",true,"operation",rows.get(0));
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void recoverInterruptedJobs() {
        // A process restart rolls back any open PostgreSQL transaction. Files are only appended.
        jdbc.update("UPDATE tenant_backups SET status='FAILED',error_message='Proceso interrumpido por reinicio del servidor',completed_at=now() WHERE status='RUNNING'");
        jdbc.update("UPDATE tenant_restore_operations SET status='FAILED',stage='FAILED',error_message='Proceso interrumpido. La transacción no confirmada se revirtió; revisar respaldo de seguridad.',completed_at=now() WHERE status='RUNNING'");
    }
    static String sha(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
    static String sha(InputStream in)throws IOException{try{MessageDigest d=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];int size;while((size=in.read(buffer))!=-1)d.update(buffer,0,size);return HexFormat.of().formatHex(d.digest());}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    static String sha(Path path)throws IOException{try(InputStream in=Files.newInputStream(path)){return sha(in);}}
    private void entry(ZipOutputStream zip,String name,byte[] bytes)throws IOException{zip.putNextEntry(new ZipEntry(name));zip.write(bytes);zip.closeEntry();}

    @Scheduled(fixedDelayString="${backups.poll-ms:60000}",initialDelayString="${backups.initial-delay-ms:30000}")
    public void scheduled() {
        try {
            jdbc.update("INSERT INTO tenant_backup_settings(tenant_id,timezone) SELECT id,timezone FROM tenants ON CONFLICT DO NOTHING");
            for(var s:jdbc.queryForList("SELECT * FROM tenant_backup_settings WHERE enabled")) {
                UUID tenant=(UUID)s.get("tenant_id"); ZonedDateTime now=ZonedDateTime.now(ZoneId.of(s.get("timezone").toString()));
                if(now.toLocalTime().isBefore(LocalTime.parse(s.get("daily_time").toString()))||now.toLocalDate().toString().equals(Objects.toString(s.get("last_run_date"),"")))continue;
                List<UUID> creators=jdbc.queryForList("SELECT DISTINCT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id AND ur.tenant_id=u.tenant_id JOIN role_permissions rp ON rp.role_id=ur.role_id AND rp.tenant_id=u.tenant_id JOIN permissions p ON p.id=rp.permission_id WHERE u.tenant_id=? AND u.status='ACTIVE' AND u.deleted_at IS NULL AND p.code='backup:create' LIMIT 1",UUID.class,tenant);
                if(creators.isEmpty())continue;
                AuthenticatedUser u=new AuthenticatedUser(creators.get(0),tenant,"backup-scheduler",Set.of("backup:create"));
                UUID id=reserve(u,"AUTOMATIC",false);
                jdbc.update("UPDATE tenant_backup_settings SET last_run_date=?::date WHERE tenant_id=?",now.toLocalDate().toString(),tenant);
                jobs.submit(()->generate(u,id));
            }
            for(var old:jdbc.queryForList("SELECT b.id,b.tenant_id FROM tenant_backups b JOIN tenant_backup_settings s ON s.tenant_id=b.tenant_id WHERE NOT b.pinned AND b.status='COMPLETED' AND b.created_at < now()-make_interval(days=>s.retention_days) AND NOT EXISTS(SELECT 1 FROM tenant_restore_operations o WHERE o.backup_id=b.id AND o.status='RUNNING')")) {
                transaction.execute(status->{
                    var eligible=jdbc.queryForList("SELECT b.created_by FROM tenant_backups b JOIN tenant_backup_settings s ON s.tenant_id=b.tenant_id WHERE b.id=? AND NOT b.pinned AND b.status='COMPLETED' AND b.created_at<now()-make_interval(days=>s.retention_days) FOR UPDATE OF b SKIP LOCKED",old.get("id"));
                    if(eligible.isEmpty())return null;
                    try{Files.deleteIfExists(packagePath((UUID)old.get("tenant_id"),(UUID)old.get("id")));}catch(IOException e){throw new UncheckedIOException(e);}
                    jdbc.update("UPDATE tenant_backups SET status='EXPIRED',payload=NULL WHERE id=? AND NOT pinned",old.get("id"));
                    audit(new AuthenticatedUser((UUID)eligible.get(0).get("created_by"),(UUID)old.get("tenant_id"),"backup-retention",Set.of("backup:read")),"BACKUP_EXPIRED",(UUID)old.get("id"),Map.of("automatic",true));return null;
                });
            }
        }catch(Exception exception){org.slf4j.LoggerFactory.getLogger(getClass()).warn("No se pudo ejecutar el ciclo de respaldos; revisar configuración y migración 050",exception);}
    }
}
