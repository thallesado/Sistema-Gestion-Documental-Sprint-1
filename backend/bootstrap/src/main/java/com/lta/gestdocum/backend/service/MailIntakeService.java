package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.security.*;

@Service
public class MailIntakeService {
    private static final Logger log = LoggerFactory.getLogger(MailIntakeService.class);
    private final DocumentOperations o;private final MailboxGateway gateway;private final IntakeFileScanner scanner;
    private final OcrService ocr;private final PlanLimitService limits;private final boolean ocrEnabled;
    private final DocumentService documents;private final DocumentStorageService storage;private final Path root;
    public MailIntakeService(DocumentOperations o,MailboxGateway gateway,IntakeFileScanner scanner,DocumentService documents,DocumentStorageService storage,OcrService ocr,PlanLimitService limits,@Value("${document-operations.intake-ocr-enabled:false}") boolean ocrEnabled,@Value("${app.storage.local-path:./data/storage}") String root){this.ocr=ocr;this.limits=limits;this.ocrEnabled=ocrEnabled;this.o=o;this.gateway=gateway;this.scanner=scanner;this.documents=documents;this.storage=storage;this.root=Path.of(root).toAbsolutePath().normalize();}
    public Map<String,Object> connections(){return o.internal("mailbox:manage",()->Map.of("connections",o.db.queryForList("SELECT * FROM mailbox_connections WHERE tenant_id=:tenant ORDER BY name",o.args()),"profiles",gateway.available(),"scannerConfigured",scanner.configured()));}
    public Map<String,Object> save(UUID id,String name,String profile,String folder,String sender,String subject,boolean enabled,int retention){return o.internal("mailbox:manage",()->{
        if(gateway.available().stream().noneMatch(x->x.get("key").equals(profile)))throw new IllegalArgumentException("Perfil no configurado en el servidor");
        var p=o.args("id",id==null?UUID.randomUUID():id,"name",name.trim(),"profile",profile,"folder",folder.trim(),"sender",sender.trim().toLowerCase(Locale.ROOT),"subject",subject.trim(),"enabled",enabled,"retention",retention);
        if(id!=null){var old=connection(id);if(!old.get("profile_key").equals(profile)||!old.get("folder").equals(folder.trim()))throw new IllegalArgumentException("Para cambiar cuenta/carpeta crea otra conexión; no se reinicia el cursor existente");}
        var row=o.one(id==null?"INSERT INTO mailbox_connections(id,tenant_id,name,profile_key,folder,sender_filter,subject_filter,enabled,created_by,retention_days) VALUES(:id,:tenant,:name,:profile,:folder,:sender,:subject,:enabled,:actor,:retention) RETURNING *":"UPDATE mailbox_connections SET name=:name,sender_filter=:sender,subject_filter=:subject,enabled=:enabled,retention_days=:retention WHERE tenant_id=:tenant AND id=:id RETURNING *",p);
        o.audit(id==null?"MAILBOX_CREATED":"MAILBOX_UPDATED","MAILBOX",(UUID)p.get("id"),Map.of("enabled",enabled));return row;
    });}
    private Map<String,Object> connection(UUID id){return o.one("SELECT * FROM mailbox_connections WHERE tenant_id=:tenant AND id=:id FOR UPDATE",o.args("id",id));}
    public Map<String,Object> test(UUID id){return o.internal("mailbox:manage",()->{var c=connection(id);gateway.test(c.get("profile_key").toString(),c.get("folder").toString());o.db.update("UPDATE mailbox_connections SET state='CONNECTED',error_code=NULL WHERE tenant_id=:tenant AND id=:id",o.args("id",id));o.audit("MAILBOX_TESTED","MAILBOX",id,Map.of("connected",true));return Map.of("connected",true);});}
    public Map<String,Object> disconnect(UUID id){return o.internal("mailbox:manage",()->{connection(id);o.db.update("UPDATE mailbox_connections SET enabled=false,state='DISCONNECTED' WHERE tenant_id=:tenant AND id=:id",o.args("id",id));o.db.update("UPDATE document_operation_jobs SET status='CANCELLED',error_code='DISCONNECTED' WHERE tenant_id=:tenant AND connection_id=:id AND status='QUEUED'",o.args("id",id));o.audit("MAILBOX_DISCONNECTED","MAILBOX",id,Map.of());return Map.of("disconnected",true);});}
    public Map<String,Object> sync(UUID id){return o.internal("mailbox:manage",()->enqueue(id));}
    Map<String,Object> enqueue(UUID id){var c=connection(id);if(!Boolean.TRUE.equals(c.get("enabled")))throw DocumentOperations.conflict("La conexión está pausada");if(!"CONNECTED".equals(c.get("state")))throw DocumentOperations.conflict("Prueba la conexión antes de sincronizar");var p=o.args("connection",id);
        if(o.db.queryForObject("SELECT count(*) FROM document_operation_jobs WHERE tenant_id=:tenant AND connection_id=:connection AND status IN('QUEUED','RUNNING')",p,Integer.class)>0)throw DocumentOperations.conflict("Ya hay una sincronización en curso");
        return o.one("INSERT INTO document_operation_jobs(tenant_id,connection_id,created_by) VALUES(:tenant,:connection,:actor) RETURNING id,status",p);
    }
    public Map<String,Object> list(String search,String status,int page){return o.internal("mail-intake:read",()->{
        var p=o.args("search","%"+search.trim()+"%","status",status==null?"":status,"offset",Math.max(0,page)*20);
        String filter=" FROM mail_intake_items WHERE tenant_id=:tenant AND (file_name ILIKE :search OR sender ILIKE :search) AND (:status='' OR status=:status)";
        return Map.of("content",o.db.queryForList("SELECT id,connection_id,sender,subject,received_at,file_name,mime_type,file_size_bytes,status,scan_result,error_code,document_id,version_id,created_at"+filter+" ORDER BY created_at DESC,id LIMIT 20 OFFSET :offset",p),"totalElements",o.db.queryForObject("SELECT count(*)"+filter,p,Long.class),"jobs",o.db.queryForList("SELECT id,connection_id,status,created_at,completed_at,received_count,error_code FROM document_operation_jobs WHERE tenant_id=:tenant ORDER BY created_at DESC LIMIT 20",p));
    });}
    public Map<String,Object> detail(UUID id){return o.internal("mail-intake:read",()->{
        var p=o.args("id",id);var row=new LinkedHashMap<>(o.one("SELECT id,connection_id,sender,subject,received_at,file_name,mime_type,file_size_bytes,status,scan_result,error_code,document_id,version_id,created_at,checksum,ocr_result,ocr_status,purged_at FROM mail_intake_items WHERE tenant_id=:tenant AND id=:id",p));
        row.put("ocrAvailable",ocrEnabled&&ocr.isConfigured());p.put("hash",row.get("checksum"));row.put("matches",o.db.queryForList("SELECT id,status,document_id FROM mail_intake_items WHERE tenant_id=:tenant AND checksum=:hash AND id<>:id LIMIT 10",p));return row;
    });}
    public FileSystemResource preview(UUID id){return o.internal("mail-intake:read",()->{
        var row=o.one("SELECT * FROM mail_intake_items WHERE tenant_id=:tenant AND id=:id AND scan_result='CLEAN' AND status IN('REVIEW_PENDING','IMPORTED')",o.args("id",id));
        if(!Set.of("application/pdf","image/png","image/jpeg").contains(row.get("mime_type")))throw DocumentOperations.conflict("Este formato no admite vista previa; revisa sus metadatos");
        o.audit("MAIL_ATTACHMENT_VIEWED","MAIL_INTAKE",id,Map.of());return new FileSystemResource(file(row));
    });}
    public Map<String,Object> reject(UUID id,String reason){return o.internal("mail-intake:reject",()->{
        var p=o.args("id",id,"reason",reason.trim());var row=o.one("UPDATE mail_intake_items SET status='REJECTED',reject_reason=:reason WHERE tenant_id=:tenant AND id=:id AND status IN('REVIEW_PENDING','QUARANTINED','SCAN_PENDING','FAILED') RETURNING id,status",p);o.audit("MAIL_ATTACHMENT_REJECTED","MAIL_INTAKE",id,Map.of("reason",reason));return row;
    });}
    public Map<String,Object> rescan(UUID id){return o.internal("mailbox:manage",()->{
        var p=o.args("id",id);var row=o.one("SELECT * FROM mail_intake_items WHERE tenant_id=:tenant AND id=:id AND status IN('SCAN_PENDING','FAILED') FOR UPDATE",p);
        try{String result=scanner.scan(Files.readAllBytes(file(row)),row.get("mime_type").toString());p.put("scan",result);p.put("status",scanStatus(result));return o.one("UPDATE mail_intake_items SET scan_result=:scan,status=:status WHERE tenant_id=:tenant AND id=:id RETURNING id,status,scan_result",p);}catch(java.io.IOException e){throw DocumentOperations.conflict("Archivo no disponible");}
    });}
    public Map<String,Object> accept(UUID id,UUID existing,DocumentCreateRequest request,String reason,String etag){return o.internal("mail-intake:accept",()->{
        o.require(existing==null?"document:create":"document:update");
        var p=o.args("id",id);var row=o.one("SELECT * FROM mail_intake_items WHERE tenant_id=:tenant AND id=:id FOR UPDATE",p);
        if(!"REVIEW_PENDING".equals(row.get("status"))||!"CLEAN".equals(row.get("scan_result")))throw DocumentOperations.conflict("El adjunto ya fue resuelto o no está habilitado para incorporación");
        Path source=file(row);UUID document=existing;String token=etag;
        if(document==null){if(request==null)throw new IllegalArgumentException("Completa los datos del documento");var r=new DocumentCreateRequest(request.documentTypeId(),request.expedientId(),request.responsibleId(),request.departmentId(),request.patientId(),request.specialty(),request.institutionalProcess(),request.metadata(),request.code(),request.name(),request.description(),request.issueDate(),request.expiryDate(),true,"MAIL_INTAKE");document=documents.create(r).id();token=storage.stateToken(document);}
        if(token==null||token.isBlank())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.PRECONDITION_REQUIRED,"Recarga el documento para obtener su ETag");
        try{
            var version=storage.upload(document,new IntakeMultipartFile(row.get("file_name").toString(),row.get("mime_type").toString(),Files.readAllBytes(source)),reason,token);
            p.put("document",document);p.put("version",version.id());
            o.db.update("UPDATE mail_intake_items SET status='IMPORTED',document_id=:document,version_id=:version,imported_by=:actor,imported_at=now() WHERE tenant_id=:tenant AND id=:id",p);
            o.audit("MAIL_ATTACHMENT_IMPORTED","MAIL_INTAKE",id,Map.of("documentId",document,"versionId",version.id()));o.jdbc.queryForObject("SELECT app.intake_import_notice(?)",Object.class,id);return Map.of("id",id,"documentId",document,"versionId",version.id(),"status","IMPORTED");
        }catch(java.io.IOException e){throw new IllegalStateException("No se pudo leer el adjunto");}
    });}
    public Map<String,Object> reconcile(UUID id,String reason){return o.internal("mail-intake:accept",()->{
        var row=o.one("SELECT * FROM mail_intake_items WHERE tenant_id=:tenant AND id=:id FOR UPDATE",o.args("id",id));
        if(!"RECONCILIATION_REQUIRED".equals(row.get("status")))throw DocumentOperations.conflict("El adjunto no requiere conciliacion");
        file(row);o.audit("MAIL_ATTACHMENT_RECONCILED","MAIL_INTAKE",id,Map.of("reason",reason,"previousDocument",Objects.toString(row.get("document_id"),""),"previousVersion",Objects.toString(row.get("version_id"),"")));
        return o.one("UPDATE mail_intake_items SET status='REVIEW_PENDING',error_code=NULL WHERE tenant_id=:tenant AND id=:id RETURNING id,status",o.args("id",id));
    });}
    public Map<String,Object> extract(UUID id,boolean consent){
        if(!consent||!ocrEnabled||!ocr.isConfigured())throw DocumentOperations.conflict("OCR externo no habilitado o sin consentimiento explicito");
        var prepared=o.internal("mail-intake:read",()->{
            o.require("ocr:create");var row=o.one("SELECT * FROM mail_intake_items WHERE tenant_id=:tenant AND id=:id AND status='REVIEW_PENDING' AND scan_result='CLEAN'",o.args("id",id));
            try{byte[] bytes=Files.readAllBytes(file(row));limits.validateOcrLimit(o.context.requireTenantId(),OcrService.countPages(bytes,row.get("mime_type").toString()));o.audit("MAIL_ATTACHMENT_OCR_REQUESTED","MAIL_INTAKE",id,Map.of("externalProcessingConsent",true));return new IntakeMultipartFile(row.get("file_name").toString(),row.get("mime_type").toString(),bytes);}catch(java.io.IOException e){throw DocumentOperations.conflict("Archivo no disponible");}
        });
        ocr.validateFile(prepared);
        // The external call happens outside the database transaction. No automatic indexing or patient creation.
        var extracted=ocr.extract(prepared.getBytes(),prepared.getContentType(),prepared.getOriginalFilename());
        return o.internal("mail-intake:read",()->{
            o.require("ocr:create");var p=o.args("id",id,"data",o.encode(extracted.data()),"status",extracted.fallback()?"FAILED":"REVIEW_REQUIRED");
            var row=o.one("UPDATE mail_intake_items SET ocr_result=cast(:data AS jsonb),ocr_status=:status WHERE tenant_id=:tenant AND id=:id AND status='REVIEW_PENDING' RETURNING id,ocr_status,ocr_result",p);
            if(!extracted.fallback())limits.recordOcrUsage(o.context.requireTenantId(),OcrService.countPages(prepared.getBytes(),prepared.getContentType()));
            o.audit("MAIL_ATTACHMENT_OCR_FINISHED","MAIL_INTAKE",id,Map.of("status",p.get("status")));return row;
        });
    }
    void purgeExpiredRejected(){
        var rows=o.db.queryForList("SELECT i.* FROM mail_intake_items i JOIN mailbox_connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id WHERE i.tenant_id=:tenant AND i.status IN('REJECTED','QUARANTINED') AND i.file_path IS NOT NULL AND i.created_at<now()-make_interval(days=>c.retention_days) ORDER BY i.created_at LIMIT 20 FOR UPDATE OF i SKIP LOCKED",o.args());
        for(var row:rows)try{
            Path target=root.resolve(row.get("file_path").toString()).normalize();Path allowed=root.resolve(o.context.requireTenantId().toString()).resolve(".mail");
            if(!target.startsWith(allowed))continue;boolean safe=true;for(Path check=target;check!=null&&check.startsWith(root);check=check.getParent())if(Files.isSymbolicLink(check))safe=false;if(!safe)continue;
            Files.deleteIfExists(target);o.db.update("UPDATE mail_intake_items SET file_path=NULL,purged_at=now() WHERE tenant_id=:tenant AND id=:id",o.args("id",row.get("id")));o.audit("MAIL_ATTACHMENT_PURGED","MAIL_INTAKE",(UUID)row.get("id"),Map.of("retention",true));
        }catch(java.io.IOException e){/* The ledger remains available; retry next cycle. */}
    }
    private Path file(Map<String,Object> row){
        try{if(row.get("file_path")==null)throw new IllegalStateException();Path path=root.resolve(row.get("file_path").toString()).normalize();if(!path.startsWith(root.resolve(o.context.requireTenantId().toString()).resolve(".mail")))throw new IllegalStateException();
            for(Path p=path;p!=null&&p.startsWith(root);p=p.getParent())if(Files.isSymbolicLink(p))throw new IllegalStateException();if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)||Files.size(path)>25L*1024*1024)throw new IllegalStateException();
            if(!hash(Files.readAllBytes(path)).equals(row.get("checksum")))throw new IllegalStateException();return path;
        }catch(Exception e){throw DocumentOperations.conflict("El adjunto falta o no conserva su integridad");}
    }
    static String hash(byte[] data){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));}catch(Exception e){throw new IllegalStateException();}}
    private static String scanStatus(String result){return result.equals("CLEAN")?"REVIEW_PENDING":result.equals("SCANNER_UNAVAILABLE")?"SCAN_PENDING":"QUARANTINED";}
    void runJob(Map<String,Object> job){
        UUID connection=(UUID)job.get("connection_id");var c=connection(connection);
        if(!Boolean.TRUE.equals(c.get("enabled")))throw DocumentOperations.conflict("Buzón desconectado");
        long validity=c.get("uid_validity")==null?0:((Number)c.get("uid_validity")).longValue();long last=((Number)c.get("last_uid")).longValue();
        var p=o.args("id",job.get("id"),"connection",connection);int[] received={0};
        List<Path> written=new ArrayList<>();
        discardOnRollback(written);
        try{
            var cursor=gateway.read(c.get("profile_key").toString(),c.get("folder").toString(),validity,last,PhysicalArchiveService.time(c.get("since_at")),c.get("sender_filter").toString(),c.get("subject_filter").toString(),a->{
                try{if(storeAttachment(connection,a,written))received[0]++;}
                catch(RuntimeException ex){log.warn("Adjunto de correo omitido uid={} ({})",a.uid(),ex.getClass().getSimpleName());}
            });
            p.put("validity",cursor.validity());p.put("last",cursor.lastUid());p.put("received",received[0]);
            o.db.update("UPDATE mailbox_connections SET uid_validity=:validity,last_uid=:last,last_sync_at=now(),state='CONNECTED',error_code=NULL WHERE tenant_id=:tenant AND id=:connection",p);
            o.db.update("UPDATE document_operation_jobs SET status='COMPLETED',completed_at=now(),received_count=:received,lease_until=NULL WHERE tenant_id=:tenant AND id=:id",p);
            o.audit("MAILBOX_SYNC_COMPLETED","MAILBOX",connection,Map.of("received",received[0]));
        }catch(Exception e){throw new IllegalStateException("MAILBOX_CONNECTION_FAILED");}
    }
    private boolean storeAttachment(UUID connection,MailboxGateway.Attachment a,List<Path> written){
        var p=o.args("connection",connection,"validity",a.validity(),"uid",a.uid(),"part",a.part());
        if(o.db.queryForObject("SELECT count(*) FROM mail_intake_items WHERE tenant_id=:tenant AND connection_id=:connection AND uid_validity=:validity AND message_uid=:uid AND part_number=:part",p,Integer.class)>0)return false;
        p.put("identity",a.identity());p.put("checksum",hash(a.data()));
        if(a.identity()!=null&&o.db.queryForObject("SELECT count(*) FROM mail_intake_items WHERE tenant_id=:tenant AND connection_id=:connection AND message_identity=:identity AND part_number=:part AND checksum=:checksum",p,Integer.class)>0)return false;
        UUID id=UUID.randomUUID();String result=scanner.scan(a.data(),a.mime());Path target=root.resolve(o.context.requireTenantId().toString()).resolve(".mail").resolve(id.toString());
        boolean storable=a.data().length>0&&a.data().length<=25*1024*1024;
        boolean storedFile=false;
        if(storable)try{Files.createDirectories(target.getParent());Files.write(target,a.data(),StandardOpenOption.CREATE_NEW);storedFile=true;if(Files.getFileStore(target).supportsFileAttributeView("posix")){Files.setPosixFilePermissions(target.getParent(),java.nio.file.attribute.PosixFilePermissions.fromString("rwx------"));Files.setPosixFilePermissions(target,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));}}catch(Exception e){throw new IllegalStateException("No se pudo guardar el adjunto en cuarentena");}
        p.put("id",id);p.put("sender",a.sender());p.put("subject",a.subject());p.put("date",a.received());p.put("name",a.name().replaceAll("[\\\\/\\r\\n]","_"));p.put("mime",a.mime());p.put("size",a.data().length);p.put("checksum",storable?hash(a.data()):null);p.put("path",storable?root.relativize(target).toString().replace('\\','/'):null);p.put("status",scanStatus(result));p.put("scan",result);
        try{o.db.update("INSERT INTO mail_intake_items(id,tenant_id,connection_id,uid_validity,message_uid,part_number,sender,subject,received_at,file_name,mime_type,file_size_bytes,checksum,file_path,status,scan_result,message_identity) VALUES(:id,:tenant,:connection,:validity,:uid,:part,:sender,:subject,:date,:name,:mime,:size,:checksum,:path,:status,:scan,:identity)",p);}
        catch(RuntimeException ex){if(storedFile)deleteQuiet(target);throw ex;}
        if(storedFile)written.add(target);return true;
    }
    /** Si la transacción del lote se revierte, los archivos ya escritos no quedan huérfanos. */
    static void discardOnRollback(List<Path> written){
        if(!TransactionSynchronizationManager.isSynchronizationActive())return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCompletion(int status){if(status==TransactionSynchronization.STATUS_ROLLED_BACK)written.forEach(MailIntakeService::deleteQuiet);}
        });
    }
    private static void deleteQuiet(Path path){try{Files.deleteIfExists(path);}catch(Exception ignored){}}
}
