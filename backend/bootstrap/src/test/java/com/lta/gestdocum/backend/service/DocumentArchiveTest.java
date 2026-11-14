package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentStatusRequest;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.repository.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import java.time.OffsetDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentArchiveTest {
    @Mock DocumentRepository repository;
    @Mock DocumentTypeRepository types;
    @Mock DocumentCategoryRepository categories;
    @Mock TenantDepartmentRepository departments;
    @Mock UserRepository users;
    @Mock PatientRepository patients;
    @Mock ExpedientRepository expedients;
    @Mock AuthenticatedUserContext context;
    @Mock ComponentPermissionService permissions;
    @InjectMocks DocumentService service;
    UUID tenant=UUID.randomUUID(), id=UUID.randomUUID();
    Document document;
    @BeforeEach void setup() {
        document=new Document(); document.setId(id); document.setTenantId(tenant); document.setName("HU15");
        document.setStatus(Document.DocumentStatus.CURRENT); document.setCurrentVersion(1);
        document.setUpdatedAt(OffsetDateTime.now()); document.setMetadata(Map.of("reference","HU15"));
        when(context.requireTenantId()).thenReturn(tenant);
        when(repository.findForStateChange(id,tenant)).thenReturn(Optional.of(document));
        lenient().when(permissions.current(ComponentFormCatalog.DOCUMENT_FORM)).thenReturn(ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM)));
        lenient().when(repository.save(any())).thenAnswer(call->call.getArgument(0));
    }
    String token() { return DocumentStateToken.from(document.getId(),document.getStatus(),document.getCurrentVersion(),document.getUpdatedAt()); }
    @Test void archiveRequiresItsOwnPermission() {
        assertThrows(AccessDeniedException.class,()->service.changeStatus(id,new DocumentStatusRequest(Document.DocumentStatus.ARCHIVED),token()));
        verify(repository,never()).save(any());
    }
    @Test void restoringAlsoRequiresArchivePermission() {
        document.setStatus(Document.DocumentStatus.ARCHIVED);
        assertThrows(AccessDeniedException.class,()->service.changeStatus(id,new DocumentStatusRequest(Document.DocumentStatus.CURRENT),token()));
        verify(repository,never()).save(any());
    }
    @Test void archiveAndRestorePreserveVersionAndMetadata() {
        when(context.hasAuthority("document:archive")).thenReturn(true);
        assertEquals(Document.DocumentStatus.ARCHIVED,service.changeStatus(id,new DocumentStatusRequest(Document.DocumentStatus.ARCHIVED),token()).status());
        assertEquals(Document.DocumentStatus.CURRENT,service.changeStatus(id,new DocumentStatusRequest(Document.DocumentStatus.CURRENT),token()).status());
        assertEquals(1,document.getCurrentVersion());
        assertEquals(Map.of("reference","HU15"),document.getMetadata());
    }
    @Test void activeWorkflowPreventsArchivingEvenWithPermission() {
        when(context.hasAuthority("document:archive")).thenReturn(true);
        when(repository.hasActiveWorkflow(tenant,id)).thenReturn(true);
        assertThrows(IllegalStateException.class,()->service.changeStatus(id,new DocumentStatusRequest(Document.DocumentStatus.ARCHIVED),token()));
        verify(repository,never()).save(any());
    }
    @Test void archivedFilesCannotBeReplaced(@org.junit.jupiter.api.io.TempDir java.nio.file.Path directory) {
        document.setStatus(Document.DocumentStatus.ARCHIVED);
        var versions=mock(DocumentVersionRepository.class);
        var storage=new DocumentStorageService(directory.toString(),repository,versions,context,null);
        var file=new org.springframework.mock.web.MockMultipartFile("file","extra.pdf","application/pdf",new byte[]{1,2,3});
        assertThrows(IllegalStateException.class,()->storage.upload(id,file,"Cambio prohibido",token()));
        verifyNoInteractions(versions);
        try (var files=java.nio.file.Files.list(directory)) { assertEquals(0,files.count()); }
        catch (java.io.IOException exception) { fail(exception); }
    }
}
