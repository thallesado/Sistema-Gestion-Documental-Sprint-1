package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.*;
import com.lta.gestdocum.backend.security.JwtService;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import jakarta.mail.*;
import jakarta.mail.internet.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Only runs against the disposable database prepared by scripts/tests/document-operations.ps1. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={"spring.config.import=","document-operations.worker-enabled=true","document-operations.initial-delay-ms=3600000","backups.initial-delay-ms=3600000","backups.poll-ms=3600000","app.tenant-databases.routing-enabled=false","app.tenant-databases.isolation-enabled=false","app.tenant-databases.provisioning-enabled=false","logging.level.root=ERROR","logging.level.com.icegreen=ERROR"})
@AutoConfigureMockMvc(print=org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@EnabledIfEnvironmentVariable(named="NEXODOCS_OPS_TEST_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/operations_test")
class DocumentOperationsIntegrationTest {
    private static final UUID TENANT=UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID LAURA=UUID.fromString("40000000-0000-0000-0000-000000000001");
    private static final Path ROOT=temp();
    private static final GreenMail MAIL=new GreenMail(new ServerSetup[]{new ServerSetup(0,"127.0.0.1",ServerSetup.PROTOCOL_SMTP),new ServerSetup(0,"127.0.0.1",ServerSetup.PROTOCOL_IMAP)});
    private static final ScanServer SCANNER=new ScanServer();
    static {MAIL.start();MAIL.setUser("recepcion@tests.invalid","receiver","test-only-mail-password");MAIL.setUser("destino@tests.invalid","recipient","test-only-mail-password");}
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){ r.add("debug",()->false); r.add("logging.level.org.springframework",()->"ERROR"); r.add("logging.level.org.hibernate",()->"ERROR");
        r.add("document-operations.intake-receive-only",()->false);
        r.add("gemini.api-key",()->"");r.add("stripe.secret-key",()->"");
        r.add("spring.datasource.url",()->System.getenv("NEXODOCS_OPS_TEST_URL"));r.add("spring.datasource.username",()->"ops_test_runtime");r.add("spring.datasource.password",()->"");
        r.add("jwt.secret",()->"isolated-test-key-not-used-outside-disposable-fixtures-0123456789");r.add("app.jwt.secret",()->"isolated-test-key-not-used-outside-disposable-fixtures-0123456789");
        r.add("app.storage.local-path",ROOT::toString);r.add("document-operations.key-file",()->ROOT.resolve("key").toString());
        r.add("app.frontend-url",()->"http://localhost:4202");r.add("document-operations.allow-insecure-local",()->true);
        r.add("spring.mail.host",()->"127.0.0.1");r.add("spring.mail.port",()->MAIL.getSmtp().getPort());r.add("spring.mail.username",()->"");r.add("spring.mail.password",()->"");r.add("spring.mail.properties.mail.smtp.auth",()->false);r.add("spring.mail.properties.mail.smtp.starttls.enable",()->false);r.add("app.mail-from",()->"noreply@tests.invalid");
        r.add("document-operations.clamav-host",()->"127.0.0.1");r.add("document-operations.clamav-port",()->SCANNER.port());
        r.add("document-operations.mail-profiles",()->"{\"test\":{\"label\":\"Laboratorio\",\"host\":\"127.0.0.1\",\"port\":"+MAIL.getImap().getPort()+",\"tls\":false,\"username\":\"receiver\",\"secret\":\"test-only-mail-password\"}}");
        r.add("nexodocs.audit.external-anchor.file-path",()->"");r.add("nexodocs.audit.anchor-key-file",()->ROOT.resolve("audit-key").toString());
    }
    @org.springframework.boot.test.web.server.LocalServerPort int port;
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JwtService jwt;@Autowired DocumentOperationWorker worker;
    @Autowired MailIntakeService mailIntake;
    @org.springframework.boot.test.mock.mockito.SpyBean GeminiClient translationProvider;
    @org.springframework.boot.test.mock.mockito.SpyBean ComponentPermissionService physicalComponents;
    JdbcTemplate admin;String token,otherToken,readOnlyToken;UUID type,document,version,location,item,loan,delivery,connection,intake;
    String externalToken,session,baseline;
    UUID requesterId,custodianId,outsiderId;String requesterToken,custodianToken,outsiderToken,physicalReadToken;UUID physicalFlowItem;
    private static Path temp(){try{return Files.createTempDirectory("nexodocs-operations-fixture-");}catch(IOException e){throw new ExceptionInInitializerError(e);}}
    @BeforeAll void fixture()throws Exception{
        var logs=(ch.qos.logback.classic.LoggerContext)org.slf4j.LoggerFactory.getILoggerFactory();logs.getLoggerList().forEach(l->l.setLevel(ch.qos.logback.classic.Level.ERROR));
        String url=System.getenv("NEXODOCS_OPS_TEST_URL");assertTrue(url.endsWith("/operations_test"));
        admin=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",""));
        assertFalse(admin.queryForObject("SELECT rolsuper FROM pg_roles WHERE rolname='ops_test_runtime'",Boolean.class));
        var permissions=admin.queryForList("SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id AND ur.tenant_id=rp.tenant_id WHERE ur.user_id=?",String.class,LAURA);
        assertTrue(permissions.contains("physical:read"));assertTrue(permissions.contains("document:deliver"));
        token=jwt.generateToken(LAURA,TENANT,"laura-fixture",permissions);
        readOnlyToken=jwt.generateToken(LAURA,TENANT,"restricted-fixture",Set.of("physical:read"));
        UUID other=admin.queryForObject("SELECT id FROM users WHERE tenant_id='20000000-0000-0000-0000-000000000002' AND deleted_at IS NULL LIMIT 1",UUID.class);
        var second=admin.queryForList("SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id AND ur.tenant_id=rp.tenant_id WHERE ur.user_id=?",String.class,other);
        if(second.isEmpty())second=List.of("physical:read");
        otherToken=jwt.generateToken(other,UUID.fromString("20000000-0000-0000-0000-000000000002"),"other-fixture",second);
        for(UUID user:List.of(LAURA,other))admin.update("INSERT INTO auth_sessions(id,tenant_id,user_id,refresh_token_hash,expires_at) SELECT gen_random_uuid(),tenant_id,id,?,now()+interval '1 day' FROM users WHERE id=?",UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-",""),user);
        type=UUID.randomUUID(); admin.update("INSERT INTO document_types(id,tenant_id,name,code,metadata_schema) VALUES(?,?,? ,?,'{}'::jsonb)",type,TENANT,"Tipo de ensayo aislado","OPS-"+type.toString().substring(0,8));
        requesterId=UUID.randomUUID();custodianId=UUID.randomUUID();outsiderId=UUID.randomUUID();
        requesterToken=physicalActor(requesterId,"Solicitante Prueba",List.of("physical:read","physical:request"));
        custodianToken=physicalActor(custodianId,"Custodio Prueba",List.of("physical:read","physical:approve","physical:handover","physical:return"));
        outsiderToken=physicalActor(outsiderId,"Otro Custodio",List.of("physical:read","physical:approve","physical:handover","physical:return"));
        physicalReadToken=physicalActor(UUID.randomUUID(),"Consulta Prueba",List.of("physical:read"));
        document=UUID.randomUUID();version=UUID.randomUUID();byte[] data=pdf("Original de prueba");Path path=ROOT.resolve(TENANT.toString()).resolve(document.toString()).resolve(version.toString());Files.createDirectories(path.getParent());Files.write(path,data);
        new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(admin.getDataSource())).executeWithoutResult(tx->{
            admin.update("INSERT INTO documents(id,tenant_id,document_type_id,author_id,code,name) VALUES(?,?,?,?,?,?)",document,TENANT,type,LAURA,"OPS-"+document.toString().substring(0,8),"Documento de prueba aislada");
            admin.update("INSERT INTO document_versions(id,tenant_id,document_id,version_number,author_id,change_reason,file_path,file_name,mime_type,file_size_bytes,checksum_sha256) VALUES(?,?,?,1,?,'Versión de prueba',?,'prueba.pdf','application/pdf',?,?)",version,TENANT,document,LAURA,TENANT+"/"+document+"/"+version,data.length,MailIntakeService.hash(data));
            admin.execute("SELECT set_config('app.tenant_id','"+TENANT+"',true)"); admin.execute("SELECT set_config('app.user_id','"+LAURA+"',true)"); admin.update("UPDATE documents SET status='APPROVED' WHERE id=?",document);baseline=admin.queryForObject("SELECT app.capture_tenant_backup(?)::text",String.class,TENANT);
        });
    }
    private JsonNode request(MockHttpServletRequestBuilder b,String auth,Object body,int expected)throws Exception{
        if(auth!=null)b.header("Authorization","Bearer "+auth);if(body!=null)b.contentType("application/json").content(json.writeValueAsBytes(body));
        var result=mvc.perform(b).andReturn();int actual=result.getResponse().getStatus();
        if(actual!=expected){String response=result.getResponse().getContentAsString();String safe="";try{safe=json.readTree(response).path("message").asText();}catch(Exception ignored){}Throwable cause=result.getResolvedException();while(cause!=null&&cause.getCause()!=null)cause=cause.getCause(); if(cause instanceof org.postgresql.util.PSQLException pg && pg.getServerErrorMessage()!=null)safe+=" SQL: "+pg.getServerErrorMessage().getMessage(); fail("HTTP esperado "+expected+" recibido "+actual+" "+safe);}
        byte[] content=result.getResponse().getContentAsByteArray();return content.length==0?json.createObjectNode():json.readTree(content);
    }
    private String physicalActor(UUID id,String name,List<String> permissions) {
        String suffix=id.toString().substring(0,8);
        admin.update("INSERT INTO users(id,tenant_id,username,email,password_hash,first_name,last_name) SELECT ?,?, ?, ?,password_hash,?,'Sintetico' FROM users WHERE id=?",id,TENANT,"hu26-"+suffix,"hu26-"+suffix+"@tests.invalid",name,LAURA);
        Long role=admin.queryForObject("INSERT INTO roles(tenant_id,name,is_active,is_system) VALUES(?,?,true,false) RETURNING id",Long.class,TENANT,"HU26 "+suffix);
        for(String permission:permissions)admin.update("INSERT INTO role_permissions(tenant_id,role_id,permission_id) SELECT ?,?,id FROM permissions WHERE code=?",TENANT,role,permission);
        admin.update("INSERT INTO user_roles(tenant_id,user_id,role_id) VALUES(?,?,?)",TENANT,id,role);
        admin.update("INSERT INTO auth_sessions(id,tenant_id,user_id,refresh_token_hash,expires_at) VALUES(gen_random_uuid(),?,?,?,now()+interval '1 day')",TENANT,id,UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-",""));
        return jwt.generateToken(id,TENANT,"hu26-"+suffix,permissions);
    }
    private String colleagueToken() {
        UUID user=admin.queryForObject("SELECT id FROM users WHERE tenant_id=? AND id<>? AND deleted_at IS NULL AND status='ACTIVE' ORDER BY id LIMIT 1",UUID.class,TENANT,LAURA);
        admin.update("INSERT INTO user_roles(tenant_id,user_id,role_id) SELECT tenant_id,?,role_id FROM user_roles WHERE tenant_id=? AND user_id=? ON CONFLICT DO NOTHING",user,TENANT,LAURA);
        admin.update("INSERT INTO auth_sessions(id,tenant_id,user_id,refresh_token_hash,expires_at) VALUES(gen_random_uuid(),?,?,?,now()+interval '1 day')",TENANT,user,UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-",""));
        var permissions=admin.queryForList("SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id AND ur.tenant_id=rp.tenant_id WHERE ur.user_id=?",String.class,user);
        return jwt.generateToken(user,TENANT,"colleague-fixture",permissions);
    }
    @Test @Order(1) void physicalCrudAndLifecycle()throws Exception{
        location=UUID.fromString(request(post("/api/v1/physical-archive/locations"),token,Map.of("name","Caja de ensayo","active",true),201).path("id").asText());
        item=UUID.fromString(request(post("/api/v1/physical-archive/items"),token,Map.of("code","FIS-TEST","name","Original de ensayo","locationId",location,"custodianId",LAURA,"condition","Completo"),201).path("id").asText());
        request(get("/api/v1/physical-archive/items"),token,null,200);
        request(delete("/api/v1/physical-archive/locations/"+location),token,null,409);
        loan=UUID.fromString(request(post("/api/v1/physical-archive/items/"+item+"/requests"),token,Map.of("reason","Consulta de prueba","dueAt",OffsetDateTime.now().plusDays(3)),201).path("id").asText());
        request(post("/api/v1/physical-archive/loans/"+loan+"/reserve"),token,Map.of(),200);
        request(post("/api/v1/physical-archive/loans/"+loan+"/handover"),token,Map.of("condition","Completo al entregar"),200);
        request(post("/api/v1/physical-archive/loans/"+loan+"/handover"),token,Map.of("condition","Completo al entregar"),409);
        request(post("/api/v1/physical-archive/loans/"+loan+"/return"),token,Map.of("condition","Carpeta con daño","locationId",location,"incident",true),200);
        assertEquals("INCIDENT",request(get("/api/v1/physical-archive/items/"+item),token,null,200).path("status").asText());
        request(post("/api/v1/physical-archive/items/"+item+"/resolve"),token,Map.of("reason","Reparación y recuento completados","condition","Original reparado y completo"),200);
        var detail=request(get("/api/v1/physical-archive/items/"+item),token,null,200);
        assertEquals("AVAILABLE",detail.path("status").asText());
        assertEquals("Original reparado y completo",detail.path("condition").asText());
        // La línea de custodia muestra quién actuó por su nombre, no por su UUID.
        assertEquals("Laura Martínez",detail.path("movements").path(0).path("actor_name").asText());
    }
    @Test @Order(2) void authorizationAndCrossTenant()throws Exception{
        request(post("/api/v1/physical-archive/locations"),readOnlyToken,Map.of("name","No autorizado","active",true),403);
        request(get("/api/v1/physical-archive/items/"+item),otherToken,null,404);
        request(get("/api/v1/physical-archive/items"),null,null,401);
        request(post("/api/v1/physical-archive/items/"+item+"/requests"),token,Map.of("reason","Consulta","dueAt",OffsetDateTime.now().minusDays(1)),400);
        assertTrue(admin.queryForObject("SELECT count(*)>0 FROM physical_movements WHERE item_id=?",Boolean.class,item));
    }
    @Test @Order(2) void concurrentReservationsAndExpiryPreservePhysicalCustody() throws Exception {
        UUID original=UUID.fromString(request(post("/api/v1/physical-archive/items"),token,Map.of("code","FIS-RACE","name","Original concurrente","locationId",location,"custodianId",LAURA,"condition","Completo"),201).path("id").asText());
        var ids=new ArrayList<UUID>();String colleague=colleagueToken();
        for(int i=0;i<2;i++)ids.add(UUID.fromString(request(post("/api/v1/physical-archive/items/"+original+"/requests"),i==0?token:colleague,Map.of("reason","Solicitud concurrente "+i,"dueAt",OffsetDateTime.now().plusDays(2)),201).path("id").asText()));
        var executor=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try{
            var calls=new ArrayList<Future<Integer>>();
            for(UUID id:ids)calls.add(executor.submit(()->{start.await();return mvc.perform(post("/api/v1/physical-archive/loans/"+id+"/reserve").header("Authorization","Bearer "+token).contentType("application/json").content("{}")).andReturn().getResponse().getStatus();}));
            start.countDown();var statuses=new ArrayList<Integer>();for(var call:calls)statuses.add(call.get(20,TimeUnit.SECONDS));Collections.sort(statuses);assertEquals(List.of(200,409),statuses);
        }finally{executor.shutdownNow();}
        UUID reserved=admin.queryForObject("SELECT id FROM physical_loans WHERE item_id=? AND status='RESERVED'",UUID.class,original);
        admin.update("UPDATE physical_loans SET reserved_until=now()-interval '1 minute' WHERE id=?",reserved);
        request(post("/api/v1/physical-archive/loans/"+reserved+"/handover"),token,Map.of("condition","No entregar"),409);
        worker.tick();
        assertEquals("AVAILABLE",request(get("/api/v1/physical-archive/items/"+original),token,null,200).path("status").asText());
        assertEquals(0,admin.queryForObject("SELECT count(*) FROM physical_loans WHERE item_id=? AND status IN('RESERVED','HANDED_OVER')",Integer.class,original));
    }
    @Test @Order(2) void physicalSeparatedRolesCancellationAndCustody() throws Exception {
        physicalFlowItem=UUID.fromString(request(post("/api/v1/physical-archive/items"),token,Map.of("code","HU26-ROLES","name","Original roles separados","locationId",location,"custodianId",custodianId,"condition","Completo"),201).path("id").asText());
        String path="/api/v1/physical-archive/items/"+physicalFlowItem;
        var body=Map.of("reason","Consulta autorizada de prueba","dueAt",OffsetDateTime.now().plusDays(2));
        request(post(path+"/requests"),physicalReadToken,body,403);
        String overclaimed=jwt.generateToken(requesterId,TENANT,"scope-fixture",List.of("physical:read","physical:request","physical:manage"));
        request(post(path+"/custodian"),overclaimed,Map.of("custodianId",outsiderId,"revision",1,"reason","Privilegio ausente en base de datos"),403);
        UUID first=UUID.fromString(request(post(path+"/requests"),requesterToken,body,201).path("id").asText());
        request(post("/api/v1/physical-archive/loans/"+first+"/reserve"),requesterToken,Map.of(),403);
        request(post("/api/v1/physical-archive/loans/"+first+"/reserve"),outsiderToken,Map.of(),403);
        request(post("/api/v1/physical-archive/loans/"+first+"/reserve"),custodianToken,Map.of(),200);
        request(post("/api/v1/physical-archive/loans/"+first+"/cancel"),requesterToken,Map.of("reason","No recogere el original reservado"),200);
        assertEquals("AVAILABLE",request(get(path),requesterToken,null,200).path("status").asText());
        UUID second=UUID.fromString(request(post(path+"/requests"),requesterToken,body,201).path("id").asText());
        request(post("/api/v1/physical-archive/loans/"+second+"/reserve"),custodianToken,Map.of(),200);
        request(post("/api/v1/physical-archive/loans/"+second+"/handover"),custodianToken,Map.of("condition","Original completo al entregar"),200);
        request(post("/api/v1/physical-archive/loans/"+second+"/return"),requesterToken,Map.of("condition","No recibido por custodio","locationId",location),403);
        var current=request(get(path),token,null,200);
        request(post(path+"/custodian"),token,Map.of("custodianId",outsiderId,"revision",current.path("revision").asInt(),"reason","Cambio autorizado de responsable"),200);
        assertEquals("ON_LOAN",request(get(path),token,null,200).path("status").asText());
        request(post(path+"/custodian"),token,Map.of("custodianId",custodianId,"revision",current.path("revision").asInt(),"reason","Edicion de ficha obsoleta"),409);
        request(post("/api/v1/physical-archive/loans/"+second+"/return"),custodianToken,Map.of("condition","Antiguo custodio no recibe","locationId",location),403);
        request(post("/api/v1/physical-archive/loans/"+second+"/return"),outsiderToken,Map.of("condition","Completo despues de inspeccion","locationId",location),200);
        // Renaming or deactivating a person does not rewrite their historical movement identity.
        admin.update("UPDATE users SET first_name='Nombre cambiado',status='INACTIVE' WHERE id=?",requesterId);
        var detail=request(get(path),token,null,200);
        assertTrue(detail.path("loans").findValuesAsText("requester_name").stream().allMatch(n->n.equals("Solicitante Prueba Sintetico")));
        assertTrue(detail.path("movements").findValuesAsText("actor_name").contains("Solicitante Prueba Sintetico"));
        admin.update("UPDATE users SET first_name='Solicitante Prueba',status='ACTIVE' WHERE id=?",requesterId);
    }
    @Test @Order(2) void physicalOverdueIsNotReturnedAndReminderIsDaily() throws Exception {
        UUID original=UUID.fromString(request(post("/api/v1/physical-archive/items"),token,Map.of("code","HU26-OVERDUE","name","Original vencido sintetico","locationId",location,"custodianId",LAURA,"condition","Completo"),201).path("id").asText());
        UUID borrowed=UUID.fromString(request(post("/api/v1/physical-archive/items/"+original+"/requests"),requesterToken,Map.of("reason","Prueba de devolucion vencida","dueAt",OffsetDateTime.now().plusDays(2)),201).path("id").asText());
        request(post("/api/v1/physical-archive/loans/"+borrowed+"/reserve"),token,Map.of(),200);
        request(post("/api/v1/physical-archive/loans/"+borrowed+"/handover"),token,Map.of("condition","Completo al entregar"),200);
        admin.update("UPDATE physical_loans SET due_at=now()-interval '1 day' WHERE id=?",borrowed);
        worker.tick();int notices=admin.queryForObject("SELECT count(*) FROM notifications WHERE related_entity_id=? AND type='PHYSICAL_OVERDUE'",Integer.class,original);
        assertEquals(2,notices);worker.tick();assertEquals(notices,admin.queryForObject("SELECT count(*) FROM notifications WHERE related_entity_id=? AND type='PHYSICAL_OVERDUE'",Integer.class,original));
        assertEquals("ON_LOAN",request(get("/api/v1/physical-archive/items/"+original),token,null,200).path("status").asText());
        assertEquals("HANDED_OVER",admin.queryForObject("SELECT status FROM physical_loans WHERE id=?",String.class,borrowed));
    }
    @Test @Order(2) void physicalSelectorsDoNotExposeHiddenDocumentIdentity() throws Exception {
        var hidden=org.mockito.Mockito.mock(ComponentFormAccess.class);
        org.mockito.Mockito.doReturn(hidden).when(physicalComponents).current(ComponentFormCatalog.DOCUMENT_FORM);
        try {
            assertEquals(0,request(get("/api/v1/physical-archive/options"),token,null,200).path("documents").size());
            request(post("/api/v1/physical-archive/items"),token,Map.of("code","HU26-HIDDEN","name","Vinculo restringido","locationId",location,"custodianId",LAURA,"documentId",document,"condition","Completo"),403);
        } finally { org.mockito.Mockito.reset(physicalComponents); }
    }
    @Test @Order(2) void physicalManagerCanMaintainPaperWithoutAccessToClinicalContent() throws Exception {
        String manager=physicalActor(UUID.randomUUID(),"Gestor de papel",List.of("physical:read","physical:manage"));
        var original=request(post("/api/v1/physical-archive/items"),token,Map.of("code","HU26-PAPER","name","Original vinculado","locationId",location,"custodianId",LAURA,"documentId",document,"condition","Completo"),201);
        String path="/api/v1/physical-archive/items/"+original.path("id").asText();
        assertEquals(0,request(get("/api/v1/physical-archive/options"),manager,null,200).path("documents").size());
        request(put(path),manager,Map.of("code","HU26-PAPER","name","Original vinculado","locationId",location,"custodianId",LAURA,"documentId",document,"condition","Carpeta reemplazada sin tocar documento digital","revision",original.path("revision").asInt()),200);
        var current=request(get(path),manager,null,200);assertEquals(document.toString(),current.path("document_id").asText());
        request(put(path),manager,Map.of("code","HU26-PAPER","name","Original vinculado","locationId",location,"custodianId",LAURA,"documentId",UUID.randomUUID(),"condition","Cambio de vinculo no autorizado","revision",current.path("revision").asInt()),403);
    }
    @Test @Order(3) void deliverySmtpOtpDownloadAndRevocation()throws Exception{
        delivery=UUID.fromString(request(post("/api/v1/deliveries"),token,Map.of("documentId",document,"versionId",version,"recipientName","Destinatario de prueba","recipientEmail","destino@tests.invalid","reason","Entrega de prueba aislada","hours",24,"allowDownload",true),202).path("id").asText());
        worker.tick();
        assertEquals("SMTP_ACCEPTED",admin.queryForObject("SELECT mail_status FROM external_deliveries WHERE id=?",String.class,delivery));
        String body=Arrays.stream(MAIL.getReceivedMessages()).filter(m->{try{return m.getSubject().equals("Entrega documental NexoDocs");}catch(Exception e){return false;}}).reduce((a,b)->b).orElseThrow().getContent().toString();
        externalToken=body.substring(body.indexOf('#')+1).split("\\s")[0];
        request(post("/api/v1/external-deliveries/code"),null,Map.of("token",externalToken),200);worker.tick();
        String otpBody=Arrays.stream(MAIL.getReceivedMessages()).filter(m->{try{return m.getSubject().equals("Código de acceso NexoDocs");}catch(Exception e){return false;}}).reduce((a,b)->b).orElseThrow().getContent().toString();
        var match=java.util.regex.Pattern.compile("\\b[0-9]{6}\\b").matcher(otpBody);assertTrue(match.find());String code=match.group();
        request(post("/api/v1/external-deliveries/verify"),null,Map.of("token",externalToken,"code","999999".equals(code)?"888888":"999999"),410);
        session=request(post("/api/v1/external-deliveries/verify"),null,Map.of("token",externalToken,"code",code),200).path("session").asText();
        assertEquals(1,request(post("/api/v1/external-deliveries/info"),null,Map.of("token",externalToken,"session",session),200).path("version").asInt());
        var content=mvc.perform(post("/api/v1/external-deliveries/content").contentType("application/json").content(json.writeValueAsBytes(Map.of("token",externalToken,"session",session,"download",true)))).andReturn();assertEquals(200,content.getResponse().getStatus());assertTrue(content.getResponse().getContentAsString().startsWith("%PDF-"));
        request(post("/api/v1/deliveries/"+delivery+"/revoke"),token,Map.of("reason","Prueba de revocación"),200);
        request(post("/api/v1/external-deliveries/info"),null,Map.of("token",externalToken,"session",session),410);
        request(get("/api/v1/deliveries/"+delivery+"/events"),token,null,200);
        String dbDump=admin.queryForObject("SELECT row_to_json(e)::text FROM external_deliveries e WHERE id=?",String.class,delivery);assertFalse(dbDump.contains(externalToken));assertFalse(dbDump.contains(session));
    }
    @Test @Order(4) void tokenTamperingAndInvalidDeliveries()throws Exception{
        request(post("/api/v1/external-deliveries/code"),null,Map.of("token",externalToken.substring(0,externalToken.length()-2)+"00"),410);
        request(post("/api/v1/deliveries"),readOnlyToken,Map.of("documentId",document,"versionId",version,"recipientName","Test","recipientEmail","destino@tests.invalid","reason","Ensayo","hours",24),403);
        request(post("/api/v1/deliveries"),token,Map.of("documentId",document,"versionId",UUID.randomUUID(),"recipientName","Test","recipientEmail","destino@tests.invalid","reason","Ensayo","hours",24),404);
        request(post("/api/v1/deliveries"),token,Map.of("documentId",document,"versionId",version,"recipientName","Test","recipientEmail","incorrecto","reason","Ensayo","hours",24),400);
    }
    @Test @Order(5) void realImapIngestScanAndAccept()throws Exception{
        connection=UUID.fromString(request(post("/api/v1/mail-intake/connections"),token,Map.of("name","Buzón de ensayo","profile","test","folder","INBOX","sender","","subject","","enabled",true),201).path("id").asText());
        request(post("/api/v1/mail-intake/connections/"+connection+"/test"),token,Map.of(),200);
        Thread.sleep(1100); MimeMessage message=new MimeMessage(Session.getInstance(new Properties()));message.setFrom("proveedor@tests.invalid");message.setRecipients(Message.RecipientType.TO,"recepcion@tests.invalid");message.setSubject("Adjunto de prueba");message.setSentDate(new Date());
        var parts=new MimeMultipart();var text=new MimeBodyPart();text.setText("Documento ficticio");parts.addBodyPart(text);var attachment=new MimeBodyPart();attachment.setDataHandler(new jakarta.activation.DataHandler(new jakarta.mail.util.ByteArrayDataSource(pdf("Adjunto recibido"),"application/pdf")));attachment.setFileName("adjunto.pdf");parts.addBodyPart(attachment);message.setContent(parts);message.saveChanges();
        var sender=new org.springframework.mail.javamail.JavaMailSenderImpl();sender.setHost("127.0.0.1");sender.setPort(MAIL.getSmtp().getPort());sender.send(message);
        request(post("/api/v1/mail-intake/connections/"+connection+"/sync"),token,Map.of(),202);worker.tick();
        var list=request(get("/api/v1/mail-intake/items"),token,null,200);assertEquals(1,list.path("totalElements").asInt());var first=list.path("content").get(0);intake=UUID.fromString(first.path("id").asText());assertEquals("REVIEW_PENDING",first.path("status").asText());
        var accepted=request(post("/api/v1/mail-intake/items/"+intake+"/accept"),token,Map.of("document",Map.of("documentTypeId",type,"name","Adjunto aceptado","code","MAIL-TEST","metadata",Map.of()),"reason","Incorporación de prueba"),200);assertTrue(accepted.hasNonNull("documentId"));
        request(post("/api/v1/mail-intake/items/"+intake+"/accept"),token,Map.of("documentId",document,"reason","No duplicar","etag","obsoleto"),409);
        request(get("/api/v1/documents/"+accepted.path("documentId").asText()),token,null,200);
        request(post("/api/v1/mail-intake/connections/"+connection+"/sync"),token,Map.of(),202);worker.tick();assertEquals(1,request(get("/api/v1/mail-intake/items"),token,null,200).path("totalElements").asInt());
    }
    @Test @Order(6) void scannerIsFailClosedAndNoUnsafePreview()throws Exception{
        var scanner=new IntakeFileScanner("",3310);assertEquals("SCANNER_UNAVAILABLE",scanner.scan(pdf("test"),"application/pdf"));assertEquals("REJECTED_TYPE",scanner.scan("script".getBytes(StandardCharsets.UTF_8),"application/pdf"));
        request(get("/api/v1/mail-intake/items/"+intake),otherToken,null,404);
        request(post("/api/v1/mail-intake/connections"),token,Map.of("name","Arbitrario","profile","unknown","folder","INBOX","enabled",true),400);
        request(get("/api/v1/mail-intake/items"),null,null,401);
    }
    @Test @Order(7) void ledgersAreNotRewoundByLogicalBackups(){
        var tables=admin.queryForList("SELECT app.backup_tables()",String.class);assertFalse(tables.contains("physical_loans"));assertFalse(tables.contains("external_deliveries"));assertFalse(tables.contains("mail_intake_items"));
        assertTrue(admin.queryForObject("SELECT count(*)>0 FROM audit_events WHERE action='EXTERNAL_VERIFIED' AND entity_id=?",Boolean.class,delivery));
        assertThrows(Exception.class,()->admin.update("UPDATE physical_movements SET action='FAKE' WHERE item_id=?",item));
    }
    @Test @Order(8) void concurrentAcceptanceCreatesOneVersion()throws Exception{
        UUID copy=UUID.randomUUID();admin.update("INSERT INTO mail_intake_items(id,tenant_id,connection_id,uid_validity,message_uid,part_number,sender,subject,received_at,file_name,mime_type,file_size_bytes,checksum,file_path,status,scan_result) SELECT ?,tenant_id,connection_id,uid_validity,message_uid+100,part_number,sender,subject,received_at,file_name,mime_type,file_size_bytes,checksum,file_path,'REVIEW_PENDING',scan_result FROM mail_intake_items WHERE id=?",copy,intake);
        byte[] body=json.writeValueAsBytes(Map.of("document",Map.of("documentTypeId",type,"name","Aceptacion concurrente","code","MAIL-RACE","metadata",Map.of()),"reason","Ensayo concurrente"));
        var executor=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try{Callable<Integer> call=()->{start.await();return mvc.perform(post("/api/v1/mail-intake/items/"+copy+"/accept").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andReturn().getResponse().getStatus();};var first=executor.submit(call);var second=executor.submit(call);start.countDown();var statuses=new ArrayList<>(List.of(first.get(),second.get()));Collections.sort(statuses);assertEquals(List.of(200,409),statuses);assertEquals(1,admin.queryForObject("SELECT count(*) FROM documents WHERE tenant_id=? AND code='MAIL-RACE'",Integer.class,TENANT));}finally{executor.shutdownNow();}
    }
    @Test @Order(8) void statusResponseEtagSupportsNextTransition()throws Exception {
        var create=mvc.perform(post("/api/v1/documents").header("Authorization","Bearer "+token).contentType("application/json").content(json.writeValueAsBytes(Map.of("documentTypeId",type,"name","ETag de prueba","code","ETAG-OPS","metadata",Map.of())))).andReturn();
        assertEquals(201,create.getResponse().getStatus());String id=json.readTree(create.getResponse().getContentAsByteArray()).path("id").asText();
        var file=new org.springframework.mock.web.MockMultipartFile("file","test.pdf","application/pdf",pdf("ETag"));var reason=new org.springframework.mock.web.MockMultipartFile("changeReason","","text/plain","Prueba de version".getBytes(StandardCharsets.UTF_8));
        var uploaded=mvc.perform(multipart("/api/v1/documents/"+id+"/versions").file(file).file(reason).header("Authorization","Bearer "+token).header("If-Match",create.getResponse().getHeader("ETag"))).andReturn();assertEquals(201,uploaded.getResponse().getStatus());
        var pending=mvc.perform(patch("/api/v1/documents/"+id+"/status").header("Authorization","Bearer "+token).header("If-Match",uploaded.getResponse().getHeader("ETag")).contentType("application/json").content("{\"status\":\"PENDING\"}")).andReturn();assertEquals(200,pending.getResponse().getStatus());
        var review=mvc.perform(patch("/api/v1/documents/"+id+"/status").header("Authorization","Bearer "+token).header("If-Match",pending.getResponse().getHeader("ETag")).contentType("application/json").content("{\"status\":\"IN_REVIEW\"}")).andReturn();assertEquals(200,review.getResponse().getStatus());
    }
    @Test @Order(9) void restorePreservesCustodyRevokesLinksAndRequiresMailReconciliation()throws Exception{
        UUID activeDelivery=UUID.fromString(request(post("/api/v1/deliveries"),token,Map.of("documentId",document,"versionId",version,"recipientName","Ensayo restauracion","recipientEmail","destino@tests.invalid","reason","Entrega antes de restaurar","hours",24,"allowDownload",true),202).path("id").asText());
        UUID activeLoan=UUID.fromString(request(post("/api/v1/physical-archive/items/"+item+"/requests"),token,Map.of("reason","Prestamo antes de restaurar","dueAt",OffsetDateTime.now().plusDays(2)),201).path("id").asText());
        request(post("/api/v1/physical-archive/loans/"+activeLoan+"/reserve"),token,Map.of(),200);request(post("/api/v1/physical-archive/loans/"+activeLoan+"/handover"),token,Map.of("condition","Completo en custodia"),200);
        int before=admin.queryForObject("SELECT count(*) FROM physical_movements WHERE item_id=?",Integer.class,item);
        var tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(admin.getDataSource()));
        tx.executeWithoutResult(status->{
            admin.execute("SELECT set_config('app.tenant_id','"+TENANT+"',true)");admin.execute("SELECT set_config('app.user_id','"+LAURA+"',true)");
            UUID backup=UUID.randomUUID(),safety=UUID.randomUUID(),operation=UUID.randomUUID();String current=admin.queryForObject("SELECT app.capture_tenant_backup(?)::text",String.class,TENANT);
            for(UUID id:List.of(backup,safety))admin.update("INSERT INTO tenant_backups(id,tenant_id,created_by,origin,status,payload,schema_signature,pinned) VALUES(?,?,?,'MANUAL','COMPLETED',?::jsonb,app.backup_schema_signature(),?)",id,TENANT,LAURA,id.equals(backup)?baseline:current,id.equals(safety));
            admin.update("INSERT INTO tenant_restore_operations(id,tenant_id,backup_id,created_by,safety_backup_id) VALUES(?,?,?,?,?)",operation,TENANT,backup,LAURA,safety);
            admin.execute("SET LOCAL ROLE nexodocs_app");admin.queryForObject("SELECT app.restore_tenant_backup(?)",Object.class,operation);
        });
        assertEquals("REVOKED",admin.queryForObject("SELECT status FROM external_deliveries WHERE id=?",String.class,activeDelivery));
        assertEquals("ON_LOAN",request(get("/api/v1/physical-archive/items/"+item),token,null,200).path("status").asText());assertEquals(before,admin.queryForObject("SELECT count(*) FROM physical_movements WHERE item_id=?",Integer.class,item));
        assertEquals("RECONCILIATION_REQUIRED",request(get("/api/v1/mail-intake/items/"+intake),token,null,200).path("status").asText());
        request(post("/api/v1/mail-intake/items/"+intake+"/reconcile"),token,Map.of("reason","Revision explicita despues de restaurar"),200);
        assertEquals("REVIEW_PENDING",request(get("/api/v1/mail-intake/items/"+intake),token,null,200).path("status").asText());
        assertTrue(admin.queryForObject("SELECT count(*)>0 FROM audit_events WHERE entity_id=? AND action='MAIL_ATTACHMENT_IMPORTED'",Boolean.class,intake));
    }
    @Test @Order(10) void translationCannotCreateOrPublishInventedContent()throws Exception{
        request(post("/api/v1/translations/requests"),token,Map.of("documentId",document,"versionId",version,"sourceLanguage","en","targetLanguage","es","consent",true),503);
        request(post("/api/v1/translations/requests/"+UUID.randomUUID()+"/publish"),token,Map.of("title","Prueba"),404);
    }
    @Test @Order(10) void translationExtractsReviewsAndPublishesSeparateDocument() throws Exception {
        org.mockito.Mockito.doReturn(true).when(translationProvider).isConfigured();
        org.mockito.Mockito.doAnswer(invocation->{
            assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
            assertTrue(invocation.getArgument(0,String.class).contains("Original de prueba"));
            return new GeminiClient.TextResult("Traduccion sintetica revisada numero 123", "test-provider", 1);
        }).when(translationProvider).generateCompleteText(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString());
        try {
            var body=Map.of("documentId",document,"versionId",version,"sourceLanguage","en","targetLanguage","es","consent",true);
            var created=request(post("/api/v1/translations/requests"),token,body,201);
            String id=created.path("id").asText(),segment=created.path("segments").get(0).path("id").asText();
            assertEquals("REVIEW_PENDING",created.path("status").asText());
            request(post("/api/v1/translations/requests"),token,body,409);
            request(patch("/api/v1/translations/requests/"+id+"/segments/"+segment),token,Map.of("reviewedText","Texto revisado","status","ACCEPTED","revision",0),403);
            UUID reviewer=admin.queryForObject("SELECT id FROM users WHERE tenant_id=? AND id<>? AND deleted_at IS NULL AND status='ACTIVE' LIMIT 1",UUID.class,TENANT,LAURA);
            admin.update("INSERT INTO user_roles(tenant_id,user_id,role_id) SELECT tenant_id,?,role_id FROM user_roles WHERE tenant_id=? AND user_id=? ON CONFLICT DO NOTHING",reviewer,TENANT,LAURA);
            admin.update("INSERT INTO auth_sessions(id,tenant_id,user_id,refresh_token_hash,expires_at) VALUES(gen_random_uuid(),?,?,?,now()+interval '1 day')",TENANT,reviewer,UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-",""));
            var permissions=admin.queryForList("SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id AND ur.tenant_id=rp.tenant_id WHERE ur.user_id=?",String.class,reviewer);
            String reviewerToken=jwt.generateToken(reviewer,TENANT,"translation-reviewer-fixture",permissions);
            request(post("/api/v1/translations/requests/"+id+"/publish"),reviewerToken,Map.of("title","Derivado de prueba"),409);
            request(patch("/api/v1/translations/requests/"+id+"/segments/"+segment),reviewerToken,Map.of("reviewedText","Texto revisado numero 123","status","ACCEPTED","revision",0),200);
            request(patch("/api/v1/translations/requests/"+id+"/segments/"+segment),reviewerToken,Map.of("reviewedText","Edicion obsoleta","status","ACCEPTED","revision",0),409);
            var published=request(post("/api/v1/translations/requests/"+id+"/publish"),reviewerToken,Map.of("title","Derivado de prueba"),200);
            assertEquals("PUBLISHED",published.path("status").asText());
            assertNotEquals(document.toString(),published.path("derived_document_id").asText());
            assertEquals(1,admin.queryForObject("SELECT count(*) FROM document_versions WHERE document_id=?",Integer.class,document));
            request(post("/api/v1/translations/requests/"+id+"/publish"),reviewerToken,Map.of("title","Duplicado"),409);
            org.mockito.Mockito.doReturn(new GeminiClient.TextResult("", "test-provider",1)).when(translationProvider).generateCompleteText(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString());
            request(post("/api/v1/translations/requests"),token,body,502);
            assertEquals(1,admin.queryForObject("SELECT count(*) FROM translation_requests WHERE document_id=? AND status='FAILED' AND error_message='TRANSLATION_PROCESSING_FAILED'",Integer.class,document));

        } finally { org.mockito.Mockito.reset(translationProvider); }
    }
    @Test @Order(11) void smtpFailureIsRecordedAndNeverReportedAsSent()throws Exception {
        MAIL.stop();
        UUID id=UUID.fromString(request(post("/api/v1/deliveries"),token,Map.of("documentId",document,"versionId",version,"recipientName","Fallo controlado","recipientEmail","destino@tests.invalid","reason","Prueba de fallo SMTP","hours",24,"allowDownload",false),202).path("id").asText());
        worker.tick();
        assertEquals("FAILED",admin.queryForObject("SELECT mail_status FROM external_deliveries WHERE id=?",String.class,id));
        assertEquals(1,admin.queryForObject("SELECT attempts FROM document_mail_outbox WHERE delivery_id=? AND kind='LINK'",Integer.class,id));
        assertEquals("SMTP_FAILED",admin.queryForObject("SELECT error_code FROM document_mail_outbox WHERE delivery_id=? AND kind='LINK'",String.class,id));
        request(post("/api/v1/deliveries/"+id+"/revoke"),token,Map.of("reason","Cierre de prueba SMTP"),200);
    }
    private String capturePhysicalBackup() {
        var tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(admin.getDataSource()));
        return tx.execute(status->{admin.execute("SELECT set_config('app.tenant_id','"+TENANT+"',true)");admin.execute("SELECT set_config('app.user_id','"+LAURA+"',true)");admin.execute("SET LOCAL ROLE nexodocs_app");return admin.queryForObject("SELECT app.capture_tenant_backup(?)::text",String.class,TENANT);});
    }
    private void restorePhysicalBackup(String payload) {
        var tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(admin.getDataSource()));
        tx.executeWithoutResult(status->{
            admin.execute("SELECT set_config('app.tenant_id','"+TENANT+"',true)");admin.execute("SELECT set_config('app.user_id','"+LAURA+"',true)");
            UUID backup=UUID.randomUUID(),safety=UUID.randomUUID(),operation=UUID.randomUUID();String current=admin.queryForObject("SELECT app.capture_tenant_backup(?)::text",String.class,TENANT);
            for(UUID id:List.of(backup,safety))admin.update("INSERT INTO tenant_backups(id,tenant_id,created_by,origin,status,payload,schema_signature,pinned) VALUES(?,?,?,'MANUAL','COMPLETED',?::jsonb,app.backup_schema_signature(),?)",id,TENANT,LAURA,id.equals(backup)?payload:current,id.equals(safety));
            admin.update("INSERT INTO tenant_restore_operations(id,tenant_id,backup_id,created_by,safety_backup_id) VALUES(?,?,?,?,?)",operation,TENANT,backup,LAURA,safety);
            admin.execute("SET LOCAL ROLE nexodocs_app");admin.queryForObject("SELECT app.restore_tenant_backup(?)",Object.class,operation);
        });
    }
    @Test @Order(12) void physicalBackupRecoversMissingEvidenceWithoutRewindingLaterCustody() throws Exception {
        UUID depot=UUID.fromString(request(post("/api/v1/physical-archive/locations"),token,Map.of("name","Deposito recuperacion HU26","active",true),201).path("id").asText());
        UUID original=UUID.fromString(request(post("/api/v1/physical-archive/items"),token,Map.of("code","HU26-RECOVERY","name","Original recuperacion","locationId",depot,"custodianId",LAURA,"condition","Completo"),201).path("id").asText());
        String old=capturePhysicalBackup();assertEquals(1,json.readTree(old).path("_physical_archive").path("format_version").asInt());
        UUID borrowed=UUID.fromString(request(post("/api/v1/physical-archive/items/"+original+"/requests"),requesterToken,Map.of("reason","Prueba de custodia despues de respaldo","dueAt",OffsetDateTime.now().plusDays(2)),201).path("id").asText());
        request(post("/api/v1/physical-archive/loans/"+borrowed+"/reserve"),token,Map.of(),200);
        request(post("/api/v1/physical-archive/loans/"+borrowed+"/handover"),token,Map.of("condition","Completo al entregar"),200);
        int movements=admin.queryForObject("SELECT count(*) FROM physical_movements WHERE item_id=?",Integer.class,original);
        restorePhysicalBackup(old);
        assertEquals("ON_LOAN",request(get("/api/v1/physical-archive/items/"+original),token,null,200).path("status").asText());
        assertEquals("HANDED_OVER",admin.queryForObject("SELECT status FROM physical_loans WHERE id=?",String.class,borrowed));
        assertEquals(movements,admin.queryForObject("SELECT count(*) FROM physical_movements WHERE item_id=?",Integer.class,original));
        String complete=capturePhysicalBackup();
        // Simulate loss only in this disposable laboratory; application roles cannot delete this evidence.
        var tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(admin.getDataSource()));
        tx.executeWithoutResult(status->{admin.execute("ALTER TABLE physical_movements DISABLE TRIGGER physical_movements_immutable");admin.update("DELETE FROM physical_movements WHERE item_id=?",original);admin.execute("ALTER TABLE physical_movements ENABLE TRIGGER physical_movements_immutable");admin.update("DELETE FROM physical_loans WHERE item_id=?",original);admin.update("DELETE FROM physical_items WHERE id=?",original);admin.update("DELETE FROM physical_locations WHERE id=?",depot);});
        restorePhysicalBackup(complete);
        assertEquals("RECONCILIATION_REQUIRED",request(get("/api/v1/physical-archive/items/"+original),token,null,200).path("status").asText());
        assertEquals(movements+1,admin.queryForObject("SELECT count(*) FROM physical_movements WHERE item_id=?",Integer.class,original));
        request(post("/api/v1/physical-archive/loans/"+borrowed+"/return"),token,Map.of("condition","Aun no se concilio","locationId",depot),409);
        request(post("/api/v1/physical-archive/items/"+original+"/resolve"),token,Map.of("reason","Verificado con el prestatario y recuento fisico"),200);
        assertEquals("ON_LOAN",request(get("/api/v1/physical-archive/items/"+original),token,null,200).path("status").asText());
        restorePhysicalBackup(complete);
        assertEquals(movements+2,admin.queryForObject("SELECT count(*) FROM physical_movements WHERE item_id=?",Integer.class,original));
        var invalid=json.readTree(complete);((com.fasterxml.jackson.databind.node.ObjectNode)invalid.path("_physical_archive").path("physical_items").get(0)).put("tenant_id","20000000-0000-0000-0000-000000000002");
        assertThrows(org.springframework.dao.DataAccessException.class,()->restorePhysicalBackup(invalid.toString()));
        assertEquals("ON_LOAN",request(get("/api/v1/physical-archive/items/"+original),token,null,200).path("status").asText());
        assertThrows(Exception.class,()->admin.update("UPDATE physical_movements SET action='REWRITE' WHERE item_id=?",original));
        request(post("/api/v1/physical-archive/loans/"+borrowed+"/return"),token,Map.of("condition","Completo tras inspeccion final","locationId",depot),200);
    }
    @Test @Order(13) void physicalEvidenceIsInTheDownloadedZipAndApiRestoreCompletes() throws Exception {
        UUID backup=UUID.fromString(request(post("/api/v1/backups"),token,null,202).path("id").asText());
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(30);String state;
        do{state=admin.queryForObject("SELECT status FROM tenant_backups WHERE id=?",String.class,backup);if(!"RUNNING".equals(state))break;Thread.sleep(100);}while(System.nanoTime()<deadline);
        assertEquals("COMPLETED",state,"El respaldo real debe generar su paquete ZIP");
        assertTrue(request(post("/api/v1/backups/"+backup+"/verify"),token,null,200).path("valid").asBoolean());
        var downloaded=mvc.perform(get("/api/v1/backups/"+backup+"/download").header("Authorization","Bearer "+token)).andReturn();assertEquals(200,downloaded.getResponse().getStatus());
        byte[] snapshot=null,manifest=null;
        try(var zip=new java.util.zip.ZipInputStream(new ByteArrayInputStream(downloaded.getResponse().getContentAsByteArray()))){
            java.util.zip.ZipEntry entry;while((entry=zip.getNextEntry())!=null){if(entry.getName().equals("snapshot.json"))snapshot=zip.readAllBytes();else if(entry.getName().equals("manifest.json"))manifest=zip.readAllBytes();}
        }
        assertNotNull(snapshot);assertNotNull(manifest);
        var physical=json.readTree(snapshot).path("_physical_archive");assertEquals(1,physical.path("format_version").asInt());
        boolean found=false;for(var row:physical.path("physical_items"))if(physicalFlowItem.toString().equals(row.path("id").asText()))found=true;assertTrue(found);
        assertTrue(physical.path("physical_movements").size()>0);
        assertEquals(TranslationSourceExtractor.sha256(snapshot),json.readTree(manifest).path("snapshotSha256").asText());
        String name=admin.queryForObject("SELECT name FROM tenants WHERE id=?",String.class,TENANT);
        UUID operation=UUID.fromString(request(post("/api/v1/backups/"+backup+"/restore"),token,Map.of("organizationName",name),202).path("id").asText());
        deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(30);
        do{state=admin.queryForObject("SELECT status FROM tenant_restore_operations WHERE id=?",String.class,operation);if(!"RUNNING".equals(state))break;Thread.sleep(100);}while(System.nanoTime()<deadline);
        assertEquals("COMPLETED",state,"La restauracion por API debe terminar: "+admin.queryForObject("SELECT error_message FROM tenant_restore_operations WHERE id=?",String.class,operation));
        assertEquals("AVAILABLE",request(get("/api/v1/physical-archive/items/"+physicalFlowItem),token,null,200).path("status").asText());
    }
    @Test @Order(10) void receiveOnlyDownloadsWithoutScannerOrReview() throws Exception {
        var service=mailIntake;
        org.springframework.test.util.ReflectionTestUtils.setField(service,"receiveOnly",true);
        try {
            byte[] expected=pdf("Recepcion automatica sin revision");
            MimeMessage message=new MimeMessage(Session.getInstance(new Properties()));message.setFrom("proveedor@tests.invalid");message.setRecipients(Message.RecipientType.TO,"recepcion@tests.invalid");message.setSubject("Cualquier asunto de recepcion");message.setSentDate(new Date());
            var parts=new MimeMultipart();var attachment=new MimeBodyPart();attachment.setDataHandler(new jakarta.activation.DataHandler(new jakarta.mail.util.ByteArrayDataSource(expected,"application/pdf")));attachment.setFileName("solo-recepcion.pdf");parts.addBodyPart(attachment);message.setContent(parts);message.saveChanges();
            var sender=new org.springframework.mail.javamail.JavaMailSenderImpl();sender.setHost("127.0.0.1");sender.setPort(MAIL.getSmtp().getPort());sender.send(message);
            request(post("/api/v1/mail-intake/connections/"+connection+"/test"),token,Map.of(),200);
            request(post("/api/v1/mail-intake/connections/"+connection+"/sync"),token,Map.of(),202);worker.tick();
            var list=request(get("/api/v1/mail-intake/items").param("search","solo-recepcion"),token,null,200);
            assertTrue(list.path("receiveOnly").asBoolean());assertEquals(1,list.path("totalElements").asInt());var item=list.path("content").get(0);String id=item.path("id").asText();
            assertEquals("RECEIVED",item.path("status").asText());assertEquals("NOT_SCANNED",item.path("scan_result").asText());assertTrue(item.path("document_id").isNull());
            var download=mvc.perform(get("/api/v1/mail-intake/items/"+id+"/download").header("Authorization","Bearer "+token)).andReturn().getResponse();
            assertEquals(200,download.getStatus());assertArrayEquals(expected,download.getContentAsByteArray());assertTrue(download.getHeader("Content-Disposition").startsWith("attachment;"));
            request(get("/api/v1/mail-intake/items/"+id+"/download"),otherToken,null,404);
            request(get("/api/v1/mail-intake/items/"+id+"/preview"),token,null,409);
            request(post("/api/v1/mail-intake/items/"+id+"/rescan"),token,Map.of(),409);
            request(post("/api/v1/mail-intake/items/"+id+"/accept"),token,Map.of("documentId",document,"reason","No incorporar en recepcion","etag","unused"),409);
            request(post("/api/v1/mail-intake/connections/"+connection+"/sync"),token,Map.of(),202);worker.tick();
            assertEquals(1,request(get("/api/v1/mail-intake/items").param("search","solo-recepcion"),token,null,200).path("totalElements").asInt());
        } finally {org.springframework.test.util.ReflectionTestUtils.setField(service,"receiveOnly",false);}
    }
    @Test @Order(20) void browserRoutesAndResponsivePages()throws Exception {
        org.junit.jupiter.api.Assumptions.assumeTrue("true".equals(System.getenv("NEXODOCS_OPS_BROWSER")),"Ejecutar script con -Browser para validar interfaz real");
        Path repo=Path.of("../..").toAbsolutePath().normalize();
        var process=new ProcessBuilder("node",repo.resolve("scripts/tests/document-operations-browser.cjs").toString()).directory(repo.toFile()).redirectErrorStream(true).start();
        try(var output=process.getOutputStream()){output.write(json.writeValueAsBytes(Map.of("backendPort",port,"token",token,"item",item,"document",document,"requesterToken",requesterToken,"custodianToken",custodianToken,"custodianId",custodianId,"outsiderToken",outsiderToken,"outsiderId",outsiderId)));}
        if(!process.waitFor(90,TimeUnit.SECONDS)){process.destroyForcibly();fail("Tiempo de prueba visual agotado");}String output=new String(process.getInputStream().readAllBytes(),StandardCharsets.UTF_8);assertEquals(0,process.exitValue(),"Fallaron rutas o vistas reales: "+output);System.out.println(output);
    }
    @Test @Order(21) void receiveOnlyBrowserUsesRealApiAndDownloadsFile()throws Exception {
        Assumptions.assumeTrue("true".equals(System.getenv("NEXODOCS_OPS_BROWSER")),"Activa -Browser");
        org.springframework.test.util.ReflectionTestUtils.setField(mailIntake,"receiveOnly",true);
        try {
            Path repo=Path.of("../..").toAbsolutePath().normalize();
            var process=new ProcessBuilder("node",repo.resolve("scripts/tests/mail-intake-receive-browser.cjs").toString()).directory(repo.toFile()).redirectErrorStream(true).start();
            try(var output=process.getOutputStream()){output.write(json.writeValueAsBytes(Map.of("backendPort",port,"token",token)));}
            if(!process.waitFor(60,TimeUnit.SECONDS)){process.destroyForcibly();fail("Tiempo de prueba de recepcion agotado");}
            String output=new String(process.getInputStream().readAllBytes(),StandardCharsets.UTF_8);assertEquals(0,process.exitValue(),output);System.out.println(output);
        } finally {org.springframework.test.util.ReflectionTestUtils.setField(mailIntake,"receiveOnly",false);}
    }
    @Test @Order(12) void translationWritesDoNotRevealDocumentTextWithoutDocumentRead()throws Exception{
        UUID requestId=UUID.randomUUID();UUID segmentId=UUID.randomUUID();
        admin.update("INSERT INTO translation_requests(id,tenant_id,document_id,version_id,version_number,source_language,target_language,status,source_hash,page_count,char_count,requested_by) VALUES(?,?,?,?,1,'en','es','REVIEW_PENDING',?,1,20,?)",requestId,TENANT,document,version,"a".repeat(64),LAURA);
        admin.update("INSERT INTO translation_segments(id,tenant_id,request_id,segment_order,source_text,translated_text,status) VALUES(?,?,?,0,?,?,'TRANSLATED')",segmentId,TENANT,requestId,"texto secreto origen","secret source text");
        String reviewer=jwt.generateToken(LAURA,TENANT,"translation-review-fixture",Set.of("translation:read","translation:review","translation:create"));
        request(get("/api/v1/translations/options"),reviewer,null,403);
        request(get("/api/v1/translations/requests"),reviewer,null,403);
        var deniedSegment=request(patch("/api/v1/translations/requests/"+requestId+"/segments/"+segmentId),reviewer,Map.of("reviewedText","filtrado","status","MODIFIED","revision",0),403);
        assertFalse(deniedSegment.toString().contains("texto secreto origen"));
        var deniedCancel=request(post("/api/v1/translations/requests/"+requestId+"/cancel"),reviewer,Map.of("reason","Intento sin acceso documental"),403);
        assertFalse(deniedCancel.toString().contains("texto secreto origen"));
        assertEquals("TRANSLATED",admin.queryForObject("SELECT status FROM translation_segments WHERE id=?",String.class,segmentId));
        assertNull(admin.queryForObject("SELECT reviewed_text FROM translation_segments WHERE id=?",String.class,segmentId));
        assertEquals("REVIEW_PENDING",admin.queryForObject("SELECT status FROM translation_requests WHERE id=?",String.class,requestId));
    }
    @AfterAll void close(){MAIL.stop();SCANNER.close();}
    private static byte[] pdf(String text){try(var pdf=new org.apache.pdfbox.pdmodel.PDDocument();var output=new ByteArrayOutputStream()){pdf.addPage(new org.apache.pdfbox.pdmodel.PDPage());pdf.getDocumentInformation().setTitle(text);try(var content=new org.apache.pdfbox.pdmodel.PDPageContentStream(pdf,pdf.getPage(0))){content.beginText();content.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA),12);content.newLineAtOffset(50,700);content.showText(text);content.endText();}pdf.save(output);return output.toByteArray();}catch(IOException e){throw new UncheckedIOException(e);}}
    private static class ScanServer implements AutoCloseable {
        final ServerSocket socket;final ExecutorService executor=Executors.newSingleThreadExecutor();
        ScanServer(){try{socket=new ServerSocket(0,20,InetAddress.getLoopbackAddress());executor.submit(()->{while(!socket.isClosed())try(Socket s=socket.accept()){InputStream in=s.getInputStream();while(in.read()!=0){}var data=new DataInputStream(in);int n;while((n=data.readInt())!=0){data.readNBytes(n);}s.getOutputStream().write("stream: OK\0".getBytes(StandardCharsets.US_ASCII));}catch(Exception ignored){}});}catch(IOException e){throw new ExceptionInInitializerError(e);}}
        int port(){return socket.getLocalPort();}public void close(){try{socket.close();}catch(IOException ignored){}executor.shutdownNow();}
    }
}
