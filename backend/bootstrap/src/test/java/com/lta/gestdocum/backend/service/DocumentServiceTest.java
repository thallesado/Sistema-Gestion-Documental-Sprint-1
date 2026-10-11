package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import com.lta.gestdocum.backend.repository.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository repository;
    @Mock
    private DocumentTypeRepository documentTypeRepository;
    @Mock
    private DocumentCategoryRepository categoryRepository;
    @Mock
    private TenantDepartmentRepository departmentRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PatientRepository patientRepository;
    @Mock
    private ExpedientRepository expedientRepository;
    @Mock
    private AuthenticatedUserContext userContext;

    @InjectMocks
    private DocumentService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID authorId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(userContext.requireUserId()).thenReturn(userId);
    }

    private Document createSampleDocument() {
        Document doc = new Document(tenantId, UUID.randomUUID(), authorId, "DOC-001", "Protocolo Clínico Compartido");
        doc.setId(UUID.randomUUID());
        doc.setStatus(DocumentStatus.APPROVED);
        return doc;
    }

    @Test
    @DisplayName("findShared() without status should delegate to repository.searchShared")
    void shouldFindSharedDocumentsWithoutStatus() {
        PageRequest pageable = PageRequest.of(0, 10);
        Document doc = createSampleDocument();
        when(repository.searchShared(tenantId, userId, "protocolo", pageable))
                .thenReturn(new PageImpl<>(List.of(doc)));

        Page<DocumentResponse> result = service.findShared("protocolo", null, pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals("DOC-001", result.getContent().get(0).code());
        verify(userContext).establishDatabaseContext();
        verify(repository).searchShared(tenantId, userId, "protocolo", pageable);
    }

    @Test
    @DisplayName("findShared() with status should delegate to repository.searchSharedAndStatus")
    void shouldFindSharedDocumentsWithStatus() {
        PageRequest pageable = PageRequest.of(0, 10);
        Document doc = createSampleDocument();
        when(repository.searchSharedAndStatus(tenantId, userId, "protocolo", DocumentStatus.APPROVED, pageable))
                .thenReturn(new PageImpl<>(List.of(doc)));

        Page<DocumentResponse> result = service.findShared("protocolo", DocumentStatus.APPROVED, pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(DocumentStatus.APPROVED, result.getContent().get(0).status());
        verify(userContext).establishDatabaseContext();
        verify(repository).searchSharedAndStatus(tenantId, userId, "protocolo", DocumentStatus.APPROVED, pageable);
    }

    @Test
    @DisplayName("findMine() should delegate to repository.searchMine")
    void shouldFindMineDocuments() {
        PageRequest pageable = PageRequest.of(0, 10);
        Document doc = createSampleDocument();
        when(repository.searchMine(tenantId, userId, "", pageable))
                .thenReturn(new PageImpl<>(List.of(doc)));

        Page<DocumentResponse> result = service.findMine("", null, pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        verify(repository).searchMine(tenantId, userId, "", pageable);
    }
}
