package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/** Explicit opt-in: run only against an isolated migrated clone with fixture storage mounted. */
@EnabledIfEnvironmentVariable(named="NEXODOCS_BACKUP_IT",matches="true")
@SpringBootTest(properties={"backups.initial-delay-ms=3600000","workflows.deadlines.initial-delay-ms=3600000"})
class TenantBackupIntegrationTest {
 static final Path storage;
 static {try{storage=Files.createTempDirectory("nexodocs-backup-it");String source=System.getenv("BACKUP_FIXTURE_STORAGE");if(source!=null)try(var walk=Files.walk(Path.of(source))){for(Path p:walk.toList()){Path target=storage.resolve(Path.of(source).relativize(p).toString());if(Files.isDirectory(p))Files.createDirectories(target);else Files.copy(p,target);}}}catch(Exception e){throw new ExceptionInInitializerError(e);}}
 @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("app.storage.local-path",storage::toString);}
 @Autowired TenantBackupService service; @Autowired JdbcTemplate jdbc;
 @MockBean AuthenticatedUserContext context;
 @Test void packageRoundTripCorruptionIsolationAuditAndDailyJob() throws Exception {
  var actor=jdbc.queryForMap("SELECT id,tenant_id FROM users WHERE email='laura@acme.com' AND deleted_at IS NULL LIMIT 1");
  UUID user=(UUID)actor.get("id"),tenant=(UUID)actor.get("tenant_id");
  var identity=new AuthenticatedUser(user,tenant,"backup-test",Set.of("backup:create"));
  when(context.require()).thenReturn(identity);when(context.requireTenantId()).thenReturn(tenant);
  service.configure(false,"02:00","America/La_Paz",30);
  Path document=storage.resolve(tenant.toString()).resolve("integration-evidence.bin");Files.createDirectories(document.getParent());Files.writeString(document,"original evidence");
  UUID id=(UUID)service.create().get("id");awaitBackup(id);
  assertEquals(true,service.verify(id).get("valid"));
  Path zip=service.download(id);byte[] bytes=Files.readAllBytes(zip);assertTrue(bytes.length>0);
  String tenantName=jdbc.queryForObject("SELECT name FROM tenants WHERE id=?",String.class,tenant);
  Files.writeString(zip,"corrupted");assertEquals(false,service.verify(id).get("valid"));assertThrows(RuntimeException.class,()->service.restore(id,tenantName));Files.write(zip,bytes);
  assertThrows(RuntimeException.class,()->service.restore(id,"wrong name"));
  UUID other=jdbc.queryForObject("SELECT id FROM tenants WHERE id<>? LIMIT 1",UUID.class,tenant);
  String otherBefore=jdbc.queryForObject("SELECT row_to_json(t)::text FROM tenants t WHERE id=?",String.class,other);
  UUID expedient=jdbc.queryForObject("SELECT id FROM expedients WHERE tenant_id=? LIMIT 1",UUID.class,tenant);
  String original=jdbc.queryForObject("SELECT name FROM expedients WHERE id=?",String.class,expedient);
  jdbc.update("UPDATE expedients SET name='Changed after backup' WHERE id=?",expedient);
  Long event=jdbc.queryForObject("INSERT INTO audit_events(tenant_id,user_id,action,entity_type,result,details) VALUES(?,?,'TEST_APPROVAL','BACKUP_TEST','SUCCESS','{}') RETURNING id",Long.class,tenant,user);
  Files.delete(document);
  String name=jdbc.queryForObject("SELECT name FROM tenants WHERE id=?",String.class,tenant);
  UUID op=(UUID)service.restore(id,name).get("id");awaitOperation(op);
  assertEquals(original,jdbc.queryForObject("SELECT name FROM expedients WHERE id=?",String.class,expedient));
  assertEquals(otherBefore,jdbc.queryForObject("SELECT row_to_json(t)::text FROM tenants t WHERE id=?",String.class,other));
  assertEquals("original evidence",Files.readString(document));
  assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM audit_events WHERE id=?",Integer.class,event));
  assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM tenant_restore_evidence WHERE operation_id=?",Integer.class,op));
  assertTrue(service.overview().containsKey("operations"));
  // Foreign tenant cannot select the original package even with a real administrator identity.
  when(context.require()).thenReturn(new AuthenticatedUser(user,other,"wrong-tenant",Set.of("backup:read")));when(context.requireTenantId()).thenReturn(other);
  assertThrows(RuntimeException.class,()->service.verify(id));
  when(context.require()).thenReturn(identity);when(context.requireTenantId()).thenReturn(tenant);
  service.configure(true,"00:00","UTC",30);jdbc.update("UPDATE tenant_backup_settings SET last_run_date=NULL WHERE tenant_id=?",tenant);
  service.scheduled();
  UUID automatic=jdbc.queryForObject("SELECT id FROM tenant_backups WHERE tenant_id=? AND origin='AUTOMATIC' ORDER BY created_at DESC LIMIT 1",UUID.class,tenant);awaitBackup(automatic);
  assertEquals("COMPLETED",jdbc.queryForObject("SELECT status FROM tenant_backups WHERE id=?",String.class,automatic));
  UUID ordinary=(UUID)service.create().get("id");awaitBackup(ordinary);
  jdbc.update("UPDATE tenant_backups SET created_at=now()-interval '31 days' WHERE id=?",ordinary);
  service.scheduled();
  assertEquals("EXPIRED",jdbc.queryForObject("SELECT status FROM tenant_backups WHERE id=?",String.class,ordinary));
  assertEquals(false,service.verify(ordinary).get("valid"));
  assertEquals("COMPLETED",jdbc.queryForObject("SELECT status FROM tenant_backups WHERE id=?",String.class,id));
  assertThrows(RuntimeException.class,()->jdbc.update("UPDATE tenant_backups SET payload='{}' WHERE id=?",id));
  assertThrows(IllegalArgumentException.class,()->service.configure(true,"29:00","UTC",30));
 }
 void awaitBackup(UUID id)throws Exception{for(int i=0;i<150;i++){String s=jdbc.queryForObject("SELECT status FROM tenant_backups WHERE id=?",String.class,id);if(!"RUNNING".equals(s)){assertEquals("COMPLETED",s,()->Objects.toString(jdbc.queryForObject("SELECT error_message FROM tenant_backups WHERE id=?",String.class,id)));return;}Thread.sleep(200);}fail("Backup timeout");}
 void awaitOperation(UUID id)throws Exception{for(int i=0;i<150;i++){String s=jdbc.queryForObject("SELECT status FROM tenant_restore_operations WHERE id=?",String.class,id);if(!"RUNNING".equals(s)){assertEquals("COMPLETED",s,()->Objects.toString(jdbc.queryForObject("SELECT error_message FROM tenant_restore_operations WHERE id=?",String.class,id)));return;}Thread.sleep(200);}fail("Restore timeout");}
}
