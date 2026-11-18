package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;
import java.time.OffsetDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MailboxGatewayProgressTest {
    @Test void reachesRecentMailPastUidGapsWithoutSkippingTheNextBatch() throws Exception {
        GreenMail mail=new GreenMail(new ServerSetup(0,"127.0.0.1",ServerSetup.PROTOCOL_IMAP));mail.start();
        try {
            var user=mail.setUser("receiver@tests.invalid","receiver","test-only");var session=Session.getInstance(new Properties());
            for(int i=0;i<500;i++){var old=new MimeMessage(session);old.setFrom("sender@tests.invalid");old.setRecipients(jakarta.mail.Message.RecipientType.TO,"receiver@tests.invalid");old.setSubject("History");old.setText("Old history");old.saveChanges();user.deliver(old);}
            long validity,firstRecentUid;
            try(var store=session.getStore("imap")){
                store.connect("127.0.0.1",mail.getImap().getPort(),"receiver","test-only");var folder=store.getFolder("INBOX");folder.open(jakarta.mail.Folder.READ_WRITE);
                folder.setFlags(folder.getMessages(),new jakarta.mail.Flags(jakarta.mail.Flags.Flag.DELETED),true);folder.expunge();
                var dated=new MimeMessage(session){@Override public Date getReceivedDate(){return Date.from(OffsetDateTime.now().minusDays(30).toInstant());}};
                dated.setFrom("sender@tests.invalid");dated.setRecipients(jakarta.mail.Message.RecipientType.TO,"receiver@tests.invalid");dated.setSubject("Before activation");dated.setText("Old retained message");dated.saveChanges();folder.appendMessages(new jakarta.mail.Message[]{dated});
                var uid=(jakarta.mail.UIDFolder)folder;validity=uid.getUIDValidity();firstRecentUid=uid.getUID(folder.getMessage(folder.getMessageCount()))+1;folder.close(false);
            }
            for(int i=0;i<101;i++){
                var message=new MimeMessage(session);message.setFrom("sender@tests.invalid");message.setRecipients(jakarta.mail.Message.RecipientType.TO,"receiver@tests.invalid");message.setSubject("Recent "+i);
                var parts=new MimeMultipart();var attachment=new MimeBodyPart();attachment.setDataHandler(new jakarta.activation.DataHandler(new jakarta.mail.util.ByteArrayDataSource(new byte[]{1,2,3},"application/pdf")));attachment.setFileName("recent-"+i+".pdf");parts.addBodyPart(attachment);message.setContent(parts);message.saveChanges();user.deliver(message);
            }
            var json=new ObjectMapper();UUID tenant=UUID.randomUUID();
            var profiles=json.writeValueAsString(Map.of("test",Map.of("tenantId",tenant.toString(),"host","127.0.0.1","port",mail.getImap().getPort(),"tls",false,"username","receiver","secret","test-only")));
            var gateway=new MailboxGateway(json,profiles,true);var attachments=new ArrayList<MailboxGateway.Attachment>();var since=OffsetDateTime.now().minusHours(1);
            try(var scope=TenantDatabaseContext.useTenant(tenant)){
                var first=gateway.read("test","INBOX",validity,400,since,"","",attachments::add);
                assertEquals(100,attachments.size());assertEquals(100,first.messages());assertEquals(firstRecentUid+99,first.lastUid());
                attachments.clear();var second=gateway.read("test","INBOX",validity,first.lastUid(),since,"","",attachments::add);
                assertEquals(1,attachments.size());assertEquals(firstRecentUid+100,second.lastUid());
                attachments.clear();gateway.read("test","INBOX",validity,second.lastUid(),since,"","",attachments::add);assertTrue(attachments.isEmpty());
                var reset=gateway.read("test","INBOX",validity+1,Long.MAX_VALUE,since,"","",attachments::add);assertEquals(100,attachments.size());assertEquals(firstRecentUid+99,reset.lastUid());
            }
        } finally {mail.stop();}
    }
    @Test void reportsDetectionBytesAndValidationBeforeDeliveringTheAttachment() throws Exception {
        GreenMail mail=new GreenMail(new ServerSetup(0,"127.0.0.1",ServerSetup.PROTOCOL_IMAP));
        mail.start();
        try {
            var user=mail.setUser("receiver@tests.invalid","receiver","test-only");
            byte[] content=new byte[150000];new Random(42).nextBytes(content);
            MimeMessage message=new MimeMessage(Session.getInstance(new Properties()));
            message.setFrom("sender@tests.invalid");message.setRecipients(jakarta.mail.Message.RecipientType.TO,"receiver@tests.invalid");message.setSubject("Any subject");
            var parts=new MimeMultipart();var attachment=new MimeBodyPart();
            attachment.setDataHandler(new jakarta.activation.DataHandler(new jakarta.mail.util.ByteArrayDataSource(content,"application/pdf")));
            attachment.setFileName("synthetic.pdf");parts.addBodyPart(attachment);message.setContent(parts);message.saveChanges();user.deliver(message);
            var json=new ObjectMapper();UUID tenant=UUID.randomUUID();
            String profiles=json.writeValueAsString(Map.of("test",Map.of("tenantId",tenant.toString(),"host","127.0.0.1","port",mail.getImap().getPort(),"tls",false,"username","receiver","secret","test-only")));
            var gateway=new MailboxGateway(json,profiles,true);
            var progress=new ArrayList<MailboxGateway.DownloadProgress>();var received=new ArrayList<MailboxGateway.Attachment>();
            try(var scope=TenantDatabaseContext.useTenant(tenant)) {
                gateway.read("test","INBOX",0,0,OffsetDateTime.now().minusDays(1),"","",a->{
                    assertEquals("VALIDATING",progress.getLast().phase());received.add(a);
                },progress::add);
            }
            assertEquals(1,received.size());assertArrayEquals(content,received.getFirst().data());
            assertEquals("DOWNLOADING",progress.getFirst().phase());assertEquals(0,progress.getFirst().downloadedBytes());
            assertEquals(content.length,progress.getLast().downloadedBytes());
            long previous=0;for(var step:progress){assertEquals("synthetic.pdf",step.fileName());assertTrue(step.downloadedBytes()>=previous);previous=step.downloadedBytes();}
        } finally {mail.stop();}
    }
}
