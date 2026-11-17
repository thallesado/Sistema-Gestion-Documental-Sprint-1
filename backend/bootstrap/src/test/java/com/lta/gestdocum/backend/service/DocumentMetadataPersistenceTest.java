package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.model.*;
import com.lta.gestdocum.backend.repository.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentMetadataPersistenceTest {
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
    final UUID tenant=UUID.randomUUID(), user=UUID.randomUUID(), type=UUID.randomUUID(), id=UUID.randomUUID();
    @BeforeEach void setup() {
        lenient().when(context.requireTenantId()).thenReturn(tenant);
        lenient().when(context.requireUserId()).thenReturn(user);
        lenient().when(permissions.current(ComponentFormCatalog.DOCUMENT_FORM)).thenReturn(ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM)));
        lenient().when(types.findByIdAndTenantId(type,tenant)).thenReturn(Optional.of(DocumentType.builder().id(type).tenantId(tenant).name("Tipo HU13").active(true).metadataSchema(Map.of("required",List.of("reference"))).build()));
    }
    @Test void incompleteDocumentsAreNotPersisted() {
        var request=new DocumentCreateRequest(type,null,null,null,null,null,null,Map.of(),"HU13","Documento",null,null,null,null,null);
        assertThrows(IllegalArgumentException.class,()->service.create(request));
        verify(repository,never()).save(any());
    }
    @Test void validMetadataIsReturnedFromPersistedDocument() {
        when(repository.save(any(Document.class))).thenAnswer(call->call.getArgument(0));
        var request=new DocumentCreateRequest(type,null,null,null,null,null,null,Map.of("reference","REF-13"),"HU13","Documento",null,null,null,null,null);
        assertEquals("REF-13",service.create(request).metadata().get("reference"));
    }
    @Test void cannotChangeMetadataDuringAnActiveWorkflow() {
        var document=new Document(tenant,type,user,"HU13","Documento");document.setId(id);
        when(repository.findForMetadataUpdate(id,tenant)).thenReturn(Optional.of(document));
        when(repository.hasActiveWorkflow(tenant,id)).thenReturn(true);
        assertThrows(IllegalStateException.class,()->service.updateMetadata(id,Map.of("reference","REF-13")));
        verify(repository,never()).save(any());
    }
    @Test void partialUpdatePreservesOtherStoredFields() {
        var document=new Document(tenant,type,user,"HU13","Documento");document.setId(id);
        document.setMetadata(Map.of("reference","REF-OLD","retained","original"));
        when(repository.findForMetadataUpdate(id,tenant)).thenReturn(Optional.of(document));
        when(repository.save(any(Document.class))).thenAnswer(call->call.getArgument(0));
        var updated=service.updateMetadata(id,Map.of("reference","REF-NEW"));
        assertEquals("REF-NEW",updated.metadata().get("reference"));
        assertEquals("original",updated.metadata().get("retained"));
    }
    @Test void invalidUpdateLeavesTheStoredValuesUntouched() {
        var document=new Document(tenant,type,user,"HU13","Documento");document.setId(id);
        document.setMetadata(Map.of("reference","REF-OLD"));
        when(repository.findForMetadataUpdate(id,tenant)).thenReturn(Optional.of(document));
        assertThrows(IllegalArgumentException.class,()->service.updateMetadata(id,Map.of("reference"," ")));
        assertEquals("REF-OLD",document.getMetadata().get("reference"));
        verify(repository,never()).save(any());
    }
}
