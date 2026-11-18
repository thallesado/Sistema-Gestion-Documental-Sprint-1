package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeUtility;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import java.net.*;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.function.Consumer;

/** Inbound IMAP: profiles are server-owned, never arbitrary hosts or credentials supplied by the browser. */
@Component
public class MailboxGateway {
    private final Map<String,Map<String,Object>> profiles;
    private final boolean local;
    public MailboxGateway(ObjectMapper json,@Value("${document-operations.mail-profiles:{}}") String configured,
                          @Value("${document-operations.allow-insecure-local:false}") boolean local){
        this.local=local;try{profiles=json.readValue(configured.isBlank()?"{}":configured,new TypeReference<>(){});}catch(Exception e){throw new IllegalArgumentException("MAILBOX_PROFILES_JSON no es válido");}
    }
    private boolean belongs(Map<String,Object> p){var route=com.lta.gestdocum.backend.security.TenantDatabaseContext.current();return route!=null&&route.tenantId()!=null&&(route.tenantId().toString().equals(p.get("tenantId"))||(local&&p.get("tenantId")==null));}
    public List<Map<String,Object>> available(){return profiles.entrySet().stream().filter(e->belongs(e.getValue())).map(e->Map.<String,Object>of("key",e.getKey(),"label",Objects.toString(e.getValue().get("label"),e.getKey()))).toList();}
    private Map<String,Object> profile(String key){var p=profiles.get(key);if(p==null||!belongs(p))throw new IllegalArgumentException("Selecciona un perfil IMAP autorizado para esta organización");return p;}
    private Store connect(String key)throws Exception {
        var p=profile(key);String host=Objects.toString(p.get("host"),"");
        if(host.isBlank())throw new IllegalArgumentException("Servidor IMAP no configurado");
        for(InetAddress ip:InetAddress.getAllByName(host))if(!local&&(ip.isAnyLocalAddress()||ip.isLoopbackAddress()||ip.isSiteLocalAddress()||ip.isLinkLocalAddress()||ip.isMulticastAddress()))throw new IllegalArgumentException("Servidor IMAP no permitido");
        boolean tls=!local||!Boolean.FALSE.equals(p.get("tls"));String protocol=tls?"imaps":"imap";
        Properties props=new Properties();String prefix="mail."+protocol+".";
        props.setProperty(prefix+"connectiontimeout","10000");props.setProperty(prefix+"timeout","15000");props.setProperty(prefix+"writetimeout","15000");props.setProperty(prefix+"ssl.checkserveridentity","true");props.setProperty(prefix+"peek","true");
        // Bound memory while avoiding thousands of network round trips for one attachment.
        props.setProperty(prefix+"fetchsize","1048576");
        if("XOAUTH2".equals(p.get("auth"))){props.setProperty(prefix+"auth.mechanisms","XOAUTH2");props.setProperty(prefix+"auth.login.disable","true");props.setProperty(prefix+"auth.plain.disable","true");}
        Session session=Session.getInstance(props);session.setDebug(false);Store store=session.getStore(protocol);
        try{store.connect(host,Integer.parseInt(Objects.toString(p.get("port"),tls?"993":"143")),Objects.toString(p.get("username"),""),Objects.toString(p.get("secret"),""));return store;}
        catch(Exception e){try{store.close();}catch(Exception ignored){}throw e;}
    }
    public void test(String key,String folder){
        try(Store store=connect(key)){Folder f=store.getFolder(folder);try{f.open(Folder.READ_ONLY);if(!(f instanceof UIDFolder))throw new IllegalArgumentException("El buzón requiere soporte UID");}finally{if(f.isOpen())f.close(false);}}
        catch(Exception e){throw new IllegalStateException("No se pudo conectar al buzón: revisa perfil, autorización, TLS y carpeta");}
    }
    public record Attachment(long validity,long uid,int part,String identity,String sender,String subject,OffsetDateTime received,String name,String mime,byte[] data){}
    public record Cursor(long validity,long lastUid,int messages){}
    public record DownloadProgress(String phase,String fileName,long downloadedBytes){}
    public Cursor read(String profile,String folder,long knownValidity,long lastUid,OffsetDateTime since,String sender,String subject,Consumer<Attachment> consumer)throws Exception {
        return read(profile,folder,knownValidity,lastUid,since,sender,subject,consumer,p->{});
    }
    public Cursor read(String profile,String folder,long knownValidity,long lastUid,OffsetDateTime since,String sender,String subject,Consumer<Attachment> consumer,Consumer<DownloadProgress> progress)throws Exception {
        try(Store store=connect(profile)){
            Folder f=store.getFolder(folder);try{
                f.open(Folder.READ_ONLY);if(!(f instanceof UIDFolder u))throw new IllegalArgumentException("Buzón sin UID");
                long validity=u.getUIDValidity();long cursor=validity==knownValidity?lastUid:0;
                // At most 100 UID positions per poll: bounded even for very large inboxes.
                long end=cursor+100;Message[] messages=u.getMessagesByUID(cursor+1,end);
                int processed=0;long latest=cursor;
                for(Message message:messages){
                    if(message==null)continue;long uid=u.getUID(message);latest=Math.max(latest,uid);processed++;
                    Date date=message.getReceivedDate();if(date==null)date=message.getSentDate();OffsetDateTime received=date==null?OffsetDateTime.now(ZoneOffset.UTC):date.toInstant().atOffset(ZoneOffset.UTC);
                    if(received.isBefore(since))continue;
                    String from="";Address[] froms=message.getFrom();if(froms!=null&&froms.length>0&&froms[0] instanceof InternetAddress a)from=a.getAddress();
                    String title=Objects.toString(message.getSubject(),"");if(!sender.isBlank()&&!from.equalsIgnoreCase(sender))continue;if(!subject.isBlank()&&!title.toLowerCase(Locale.ROOT).contains(subject.toLowerCase(Locale.ROOT)))continue;
                    if(message.getSize()>26*1024*1024){consumer.accept(new Attachment(validity,uid,1,identity(message),trim(from,254),trim(title,255),received,"mensaje-demasiado-grande","application/octet-stream",new byte[0]));continue;}
                    List<Part> parts=new ArrayList<>();attachments(message,parts,0);int index=0;
                    for(Part part:parts){if(++index>10)break;String name=trim(MimeUtility.decodeText(Objects.toString(part.getFileName(),"adjunto")),255);String mime=normalizeMime(part.getContentType());
                        progress.accept(new DownloadProgress("DOWNLOADING",name,0));
                        byte[] data;try(InputStream input=part.getInputStream();ByteArrayOutputStream buffer=new ByteArrayOutputStream()){
                            byte[] chunk=new byte[65536];int n;int limit=25*1024*1024+1;
                            while(buffer.size()<limit&&(n=input.read(chunk,0,Math.min(chunk.length,limit-buffer.size())))!=-1){
                                buffer.write(chunk,0,n);progress.accept(new DownloadProgress("DOWNLOADING",name,buffer.size()));
                            }
                            data=buffer.toByteArray();
                        }
                        progress.accept(new DownloadProgress("VALIDATING",name,data.length));
                        consumer.accept(new Attachment(validity,uid,index,identity(message),trim(from,254),trim(title,255),received,name,mime,data));
                    }
                }
                // Empty UID gaps are expected; never skip past the server's current UIDNEXT.
                long next=u.getUIDNext();if(next>0)latest=Math.max(latest,Math.min(end,next-1));
                return new Cursor(validity,latest,processed);
            }finally{if(f.isOpen())f.close(false);}
        }
    }
    private static String identity(Message message)throws MessagingException {
        String[] header=message.getHeader("Message-ID");return header==null||header.length==0?null:MailIntakeService.hash(header[0].trim().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    private static void attachments(Part p,List<Part> result,int depth)throws Exception{
        if(depth>5||result.size()>=10)return;
        if(p.isMimeType("multipart/*")){Multipart m=(Multipart)p.getContent();for(int i=0;i<m.getCount()&&result.size()<10;i++)attachments(m.getBodyPart(i),result,depth+1);}
        else if(Part.ATTACHMENT.equalsIgnoreCase(p.getDisposition())||p.getFileName()!=null)result.add(p);
    }
    /** Tipo MIME sin parámetros, apto para mime_type varchar(150); si no es válido, binario genérico. */
    static String normalizeMime(String contentType){
        String mime=contentType==null?"":contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        return mime.isEmpty()||mime.length()>150||!mime.matches("[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+")?"application/octet-stream":mime;
    }
    private static String trim(String value,int max){return value.substring(0,Math.min(max,value.length())).replaceAll("[\\r\\n]"," ");}
}
