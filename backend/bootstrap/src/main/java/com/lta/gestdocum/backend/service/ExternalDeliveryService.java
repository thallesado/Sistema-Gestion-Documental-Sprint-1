package com.lta.gestdocum.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class ExternalDeliveryService {
    private final DocumentOperations o;
    private final DocumentOperationsSecrets secrets;
    private final ComponentPermissionService components;
    private final Path root;
    private final String frontend;
    private final boolean insecureLocal;
    public ExternalDeliveryService(DocumentOperations o,DocumentOperationsSecrets secrets,ComponentPermissionService components,
            @Value("${app.storage.local-path:./data/storage}") String root,
            @Value("${app.frontend-url}") String frontend,
            @Value("${document-operations.allow-insecure-local:false}") boolean insecureLocal){
        this.o=o;this.secrets=secrets;this.components=components;this.root=Path.of(root).toAbsolutePath().normalize();this.frontend=frontend.replaceAll("/$","");this.insecureLocal=insecureLocal;
    }
    private static final String SAFE="e.id,e.document_id,e.version_id,e.version_number,e.recipient_name,e.recipient_email,e.reason,e.allow_download,e.expires_at,e.created_at,e.mail_status,e.revoked_at,e.revoke_reason,e.last_access_at,CASE WHEN e.status='ACTIVE' AND e.expires_at<=now() THEN 'EXPIRED' ELSE e.status END AS status";
    private void fullAccess(){var a=components.current(ComponentFormCatalog.DOCUMENT_FORM);if(a.states().values().stream().anyMatch(s->!s.isVisible()))throw new AccessDeniedException("No puedes entregar archivos completos con información documental oculta para tu perfil");}
    public Map<String,Object> options(UUID document){return o.internal("document:deliver",()->{
        o.require("document:read");o.require("delivery:read");fullAccess();
        var p=o.args("document",document);
        String extra=document==null?"":" AND d.id=:document";
        var rows=o.db.queryForList("SELECT d.id AS document_id,d.code,d.name,v.id AS version_id,v.version_number,v.mime_type,v.file_size_bytes FROM documents d JOIN document_versions v ON v.tenant_id=d.tenant_id AND v.document_id=d.id AND v.version_number=d.current_version WHERE d.tenant_id=:tenant AND d.deleted_at IS NULL AND d.status IN('APPROVED','CURRENT') AND v.file_path IS NOT NULL AND v.file_path<>'' AND v.checksum_sha256 IS NOT NULL"+extra+" ORDER BY d.name LIMIT 100",p);
        return Map.of("versions",rows,"httpsRequired",!insecureLocal,"frontendUrl",frontend);
    });}
    public Map<String,Object> create(UUID document,UUID version,String name,String email,String reason,int hours,boolean download){return o.internal("document:deliver",()->{
        o.require("document:read");o.require("delivery:read");fullAccess();
        if(!frontend.startsWith("https://")&&!(insecureLocal&&frontend.matches("http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?")))throw DocumentOperations.conflict("Configura HTTPS antes de habilitar entregas externas");
        if(hours<1||hours>168)throw new IllegalArgumentException("Vigencia entre 1 y 168 horas");
        var p=o.args("document",document,"version",version);
        var d=o.one("SELECT d.id,v.version_number,v.file_path,v.checksum_sha256 FROM documents d JOIN document_versions v ON v.tenant_id=d.tenant_id AND v.document_id=d.id WHERE d.tenant_id=:tenant AND d.id=:document AND v.id=:version AND d.current_version=v.version_number AND d.deleted_at IS NULL AND d.status IN('APPROVED','CURRENT') AND v.file_path IS NOT NULL AND v.file_path<>'' AND v.checksum_sha256 IS NOT NULL FOR SHARE OF d",p);
        checkedFile(o.context.requireTenantId(),d.get("file_path").toString(),d.get("checksum_sha256").toString());
        UUID id=UUID.randomUUID();OffsetDateTime expires=OffsetDateTime.now(ZoneOffset.UTC).plusHours(hours);
        String token=secrets.token(o.context.requireTenantId(),id,expires.toInstant());
        p.putAll(Map.of("id",id,"number",d.get("version_number"),"checksum",d.get("checksum_sha256"),"name",name.trim(),"email",email.trim().toLowerCase(Locale.ROOT),"reason",reason.trim(),"download",download,"hash",secrets.hash(token),"encrypted",secrets.encrypt(token),"expires",expires));
        o.db.update("INSERT INTO external_deliveries(id,tenant_id,created_by,document_id,version_id,version_number,source_checksum,recipient_name,recipient_email,reason,allow_download,token_hash,encrypted_token,expires_at) VALUES(:id,:tenant,:actor,:document,:version,:number,:checksum,:name,:email,:reason,:download,:hash,:encrypted,:expires)",p);
        enqueue(id,"LINK",linkBody(token));o.audit("DELIVERY_CREATED","DELIVERY",id,Map.of("versionId",version,"expiresAt",expires.toString()));
        return o.one("SELECT "+SAFE+" FROM external_deliveries e WHERE e.tenant_id=:tenant AND e.id=:id",p);
    });}
    private String linkBody(String token){return "Has recibido una entrega documental de NexoDocs. Verifica tu correo para acceder.\n\n"+frontend+"/external/delivery#"+token+"\n\nEl enlace tiene vencimiento. No reenvíes este mensaje.";}
    private void enqueue(UUID id,String kind,String body){o.db.update("INSERT INTO document_mail_outbox(tenant_id,delivery_id,created_by,kind,encrypted_body) VALUES(:tenant,:id,:actor,:kind,:body)",o.args("id",id,"kind",kind,"body",secrets.encrypt(body)));}
    public Map<String,Object> list(String search,int page){return o.internal("delivery:read",()->{
        o.require("document:read");fullAccess();var p=o.args("search","%"+search.trim()+"%","offset",Math.max(0,page)*20);
        String where=" FROM external_deliveries e WHERE e.tenant_id=:tenant AND (e.recipient_name ILIKE :search OR e.recipient_email ILIKE :search)";
        return Map.of("content",o.db.queryForList("SELECT "+SAFE+where+" ORDER BY e.created_at DESC,e.id LIMIT 20 OFFSET :offset",p),"totalElements",o.db.queryForObject("SELECT count(*)"+where,p,Long.class));
    });}
    public Map<String,Object> events(UUID id){return o.internal("delivery:read",()->{
        o.require("document:read");fullAccess();o.one("SELECT id FROM external_deliveries WHERE tenant_id=:tenant AND id=:id",o.args("id",id));
        return Map.of("events",o.db.queryForList("SELECT action,result,occurred_at,user_id,details FROM audit_events WHERE tenant_id=:tenant AND entity_type='DELIVERY' AND entity_id=:id ORDER BY occurred_at DESC LIMIT 100",o.args("id",id)));
    });}
    public Map<String,Object> revoke(UUID id,String reason){return o.internal("delivery:revoke",()->{
        o.require("document:read");fullAccess();var p=o.args("id",id,"reason",reason.trim());
        var row=o.one("UPDATE external_deliveries SET status='REVOKED',revoked_at=now(),revoked_by=:actor,revoke_reason=:reason,session_hash=NULL,session_expires_at=NULL,code_hash=NULL,encrypted_token='' WHERE tenant_id=:tenant AND id=:id AND status='ACTIVE' RETURNING id",p);
        o.db.update("UPDATE document_mail_outbox SET status='CANCELLED',encrypted_body='' WHERE tenant_id=:tenant AND delivery_id=:id AND status<>'SENT'",p);
        o.audit("DELIVERY_REVOKED","DELIVERY",id,Map.of("reason",reason));return row;
    });}
    public Map<String,Object> resend(UUID id){return o.internal("document:deliver",()->{
        o.require("delivery:read");o.require("document:read");fullAccess();var p=o.args("id",id);
        var e=o.one("SELECT encrypted_token FROM external_deliveries WHERE tenant_id=:tenant AND id=:id AND status='ACTIVE' AND expires_at>now() FOR UPDATE",p);
        if(o.db.queryForObject("SELECT count(*) FROM document_mail_outbox WHERE tenant_id=:tenant AND delivery_id=:id AND kind='LINK' AND created_at>now()-interval '5 minutes'",p,Integer.class)>0)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Espera cinco minutos antes de reenviar");
        enqueue(id,"LINK",linkBody(secrets.decrypt(e.get("encrypted_token").toString())));o.db.update("UPDATE external_deliveries SET mail_status='PENDING' WHERE tenant_id=:tenant AND id=:id",p);o.audit("DELIVERY_RESENT","DELIVERY",id,Map.of());return Map.of("status","PENDING");
    });}
    @SuppressWarnings("unchecked")
    private Map<String,Object> call(String token,String action,String code,String session,String encrypted){
        var claim=secrets.parse(token);
        return o.external(claim.tenant(),()->{
            String result=o.jdbc.queryForObject("SELECT app.delivery_public(?,?,?,?,?,?)::text",String.class,claim.delivery(),secrets.hash(token),action,code,session,encrypted);
            try{return o.json.readValue(result,Map.class);}catch(Exception ex){throw new IllegalStateException("Respuesta no disponible");}
        });
    }
    public Map<String,Object> requestCode(String token){
        String code=DocumentOperationsSecrets.code();var result=call(token,"code",secrets.hash(token+":"+code),null,secrets.encrypt("Tu código de acceso a NexoDocs es: "+code+"\nVence en 10 minutos. No lo compartas."));
        if(Boolean.TRUE.equals(result.get("rateLimited")))throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Espera antes de solicitar otro código");
        if(!Boolean.TRUE.equals(result.get("available")))throw unavailable();return Map.of("message","Si el acceso está vigente, recibirás un código en el correo registrado.");
    }
    public Map<String,Object> verify(String token,String code){String session=DocumentOperationsSecrets.random();var r=call(token,"verify",secrets.hash(token+":"+code),secrets.hash(session),null);if(!Boolean.TRUE.equals(r.get("available")))throw unavailable();return Map.of("session",session,"expiresInSeconds",1200);}
    public Map<String,Object> info(String token,String session){var r=call(token,"info",null,secrets.hash(session),null);if(!Boolean.TRUE.equals(r.get("available")))throw unavailable();return r;}
    public record Content(Resource resource,String filename,String mime){}
    public Content content(String token,String session,boolean download){
        var r=call(token,download?"download":"view",null,secrets.hash(session),null);if(!Boolean.TRUE.equals(r.get("available")))throw unavailable();
        var claim=secrets.parse(token);Path path=checkedFile(claim.tenant(),r.get("path").toString(),r.get("checksum").toString());
        return new Content(new FileSystemResource(path),r.get("fileName").toString(),r.get("mimeType").toString());
    }
    private Path checkedFile(UUID tenant,String relative,String checksum){
        try{Path path=root.resolve(relative).normalize();if(!path.startsWith(root.resolve(tenant.toString()))||!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS))throw unavailable();
            for(Path p=path;p!=null&&p.startsWith(root);p=p.getParent())if(Files.isSymbolicLink(p))throw unavailable();
            MessageDigest digest=MessageDigest.getInstance("SHA-256");try(var input=new DigestInputStream(Files.newInputStream(path),digest)){input.transferTo(java.io.OutputStream.nullOutputStream());}
            if(!MessageDigest.isEqual(HexFormat.of().formatHex(digest.digest()).getBytes(java.nio.charset.StandardCharsets.US_ASCII),checksum.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))throw unavailable();return path;
        }catch(ResponseStatusException ex){throw ex;}catch(Exception ex){throw unavailable();}
    }
    private static ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.GONE,"Acceso no disponible o verificación inválida");}
}
