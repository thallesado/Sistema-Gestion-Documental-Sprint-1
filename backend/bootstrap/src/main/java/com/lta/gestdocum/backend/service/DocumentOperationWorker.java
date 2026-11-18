package com.lta.gestdocum.backend.service;

import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import java.util.*;

/** One bounded application worker, never the privileged database provisioner. DB row locks serialize replicas. */
@Component
@ConditionalOnProperty(name="document-operations.worker-enabled",havingValue="true",matchIfMissing=true)
public class DocumentOperationWorker {
    private final DocumentOperations o;private final DocumentOperationsSecrets secrets;private final JavaMailSender mail;
    private final MailIntakeService intake;private final PhysicalArchiveService physical;private final String from;
    public DocumentOperationWorker(DocumentOperations o,DocumentOperationsSecrets secrets,JavaMailSender mail,MailIntakeService intake,PhysicalArchiveService physical,@Value("${app.mail-from}") String from){this.o=o;this.secrets=secrets;this.mail=mail;this.intake=intake;this.physical=physical;this.from=from;}
    @Scheduled(fixedDelayString="${document-operations.poll-ms:60000}",initialDelayString="${document-operations.initial-delay-ms:30000}")
    public void tick(){
        o.background("document:deliver",actor->o.as(actor,"document:deliver",()->{sendOne();return null;}));
        o.background("physical:approve",actor->o.as(actor,"physical:approve",()->{physical.maintenance();return null;}));
        o.background("mailbox:manage",actor->{
            var job=o.as(actor,"mailbox:manage",()->{
                intake.purgeExpiredRejected();
                o.db.update("UPDATE document_operation_jobs SET status='QUEUED',lease_until=NULL,error_code='INTERRUPTED' WHERE tenant_id=:tenant AND status='RUNNING' AND lease_until<now()",o.args());
                // Automatic polling is opt-in per connection, every two minutes at most.
                var due=o.db.queryForList("SELECT id FROM mailbox_connections c WHERE tenant_id=:tenant AND enabled AND state='CONNECTED' AND (last_sync_at IS NULL OR last_sync_at<now()-interval '2 minutes') AND NOT EXISTS(SELECT 1 FROM document_operation_jobs j WHERE j.tenant_id=c.tenant_id AND j.connection_id=c.id AND (j.status IN('QUEUED','RUNNING') OR j.created_at>now()-interval '2 minutes')) ORDER BY created_at LIMIT 1",o.args());
                if(!due.isEmpty())intake.enqueue((UUID)due.getFirst().get("id"));
                var jobs=o.db.queryForList("SELECT * FROM document_operation_jobs WHERE tenant_id=:tenant AND status='QUEUED' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",o.args());
                if(jobs.isEmpty())return null;var j=jobs.getFirst();o.db.update("UPDATE document_operation_jobs SET status='RUNNING',started_at=now(),lease_until=now()+interval '10 minutes' WHERE tenant_id=:tenant AND id=:id",o.args("id",j.get("id")));return j;
            });
            if(job!=null)try{o.as(actor,"mailbox:manage",()->{var locked=o.one("SELECT * FROM document_operation_jobs WHERE tenant_id=:tenant AND id=:id AND status='RUNNING' FOR UPDATE",o.args("id",job.get("id")));intake.runJob(locked);return null;});}
            catch(RuntimeException e){o.as(actor,"mailbox:manage",()->{o.db.update("UPDATE document_operation_jobs SET status='FAILED',completed_at=now(),lease_until=NULL,error_code='MAILBOX_CONNECTION_FAILED' WHERE tenant_id=:tenant AND id=:id",o.args("id",job.get("id")));o.db.update("UPDATE mailbox_connections SET state='SYNC_ERROR',error_code='MAILBOX_CONNECTION_FAILED' WHERE tenant_id=:tenant AND id=:id",o.args("id",job.get("connection_id")));o.audit("MAILBOX_SYNC_FAILED","MAILBOX",(UUID)job.get("connection_id"),Map.of());return null;});}
        });
    }
    private void sendOne(){
        var p=o.args();
        o.db.update("UPDATE document_mail_outbox SET status='CANCELLED',encrypted_body='' WHERE tenant_id=:tenant AND status IN('PENDING','FAILED') AND delivery_id IN(SELECT id FROM external_deliveries WHERE tenant_id=:tenant AND (status='REVOKED' OR expires_at<=now()))",p);
        var rows=o.db.queryForList("SELECT q.*,e.recipient_email,e.expires_at FROM document_mail_outbox q JOIN external_deliveries e ON e.id=q.delivery_id AND e.tenant_id=q.tenant_id WHERE q.tenant_id=:tenant AND q.status IN('PENDING','FAILED') AND q.attempts<3 AND q.available_at<=now() AND e.status='ACTIVE' AND e.expires_at>now() ORDER BY CASE WHEN q.kind='CODE' THEN 0 ELSE 1 END,q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1",p);
        if(rows.isEmpty())return;var row=rows.getFirst();p.put("id",row.get("id"));p.put("delivery",row.get("delivery_id"));
        try{
            var message=new SimpleMailMessage();message.setFrom(from);message.setTo(row.get("recipient_email").toString());message.setSubject(row.get("kind").equals("CODE")?"Código de acceso NexoDocs":"Entrega documental NexoDocs");message.setText(secrets.decrypt(row.get("encrypted_body").toString()));mail.send(message);
            o.db.update("UPDATE document_mail_outbox SET status='SENT',attempts=attempts+1,sent_at=now(),encrypted_body='',error_code=NULL WHERE tenant_id=:tenant AND id=:id",p);
            if(row.get("kind").equals("LINK"))o.db.update("UPDATE external_deliveries SET mail_status='SMTP_ACCEPTED' WHERE tenant_id=:tenant AND id=:delivery",p);
            o.audit("DELIVERY_MAIL_ACCEPTED","DELIVERY",(UUID)row.get("delivery_id"),Map.of("kind",row.get("kind")));
        }catch(RuntimeException e){
            o.db.update("UPDATE document_mail_outbox SET status='FAILED',attempts=attempts+1,available_at=now()+interval '1 minute',error_code='SMTP_FAILED' WHERE tenant_id=:tenant AND id=:id",p);
            if(row.get("kind").equals("LINK"))o.db.update("UPDATE external_deliveries SET mail_status='FAILED' WHERE tenant_id=:tenant AND id=:delivery",p);
            o.audit("DELIVERY_MAIL_FAILED","DELIVERY",(UUID)row.get("delivery_id"),Map.of("kind",row.get("kind")));
        }
    }
}
