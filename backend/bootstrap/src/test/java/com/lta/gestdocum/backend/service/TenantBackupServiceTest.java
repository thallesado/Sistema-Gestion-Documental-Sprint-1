package com.lta.gestdocum.backend.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.nio.file.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class TenantBackupServiceTest {
 @TempDir Path root;
 @Test void rejectsCrossTenantTraversalAndLinks() throws Exception {
  TenantBackupService service=new TenantBackupService(mock(JdbcTemplate.class),new ObjectMapper(),mock(AuthenticatedUserContext.class),mock(PlatformTransactionManager.class),root.toString());
  UUID tenant=UUID.randomUUID(),other=UUID.randomUUID();
  assertEquals(root.resolve(tenant.toString()).resolve("document/file"),service.safeFile(tenant,tenant+"/document/file"));
  assertThrows(IllegalArgumentException.class,()->service.safeFile(tenant,other+"/file"));
  assertThrows(IllegalArgumentException.class,()->service.safeFile(tenant,tenant+"/../../outside"));
  Path folder=Files.createDirectories(root.resolve(tenant.toString()));
  if(!System.getProperty("os.name").toLowerCase().contains("windows")) {
   Files.createSymbolicLink(folder.resolve("link"),root.resolve(other.toString()));
   assertThrows(IllegalArgumentException.class,()->service.safeFile(tenant,tenant+"/link/file"));
  }
  service.close();
 }
 @Test void digestDetectsCorruption() throws Exception {
  assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",TenantBackupService.sha("abc".getBytes()));
  Path p=root.resolve("package");Files.writeString(p,"abc");String original=TenantBackupService.sha(p);Files.writeString(p,"abd");assertNotEquals(original,TenantBackupService.sha(p));
 }
}
