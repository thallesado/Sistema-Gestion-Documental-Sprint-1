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
