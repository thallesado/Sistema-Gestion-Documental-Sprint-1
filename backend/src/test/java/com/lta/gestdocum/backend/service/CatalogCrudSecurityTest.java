package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentTypeRequest;
import com.lta.gestdocum.backend.dto.TenantDepartmentRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.DocumentType;
import com.lta.gestdocum.backend.model.Tag;
import com.lta.gestdocum.backend.repository.DocumentTypeRepository;
import com.lta.gestdocum.backend.repository.TagRepository;
import com.lta.gestdocum.backend.repository.TenantDepartmentRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogCrudSecurityTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID OTHER_TENANT_ID = UUID.randomUUID();

    @Mock
    private TenantDepartmentRepository departmentRepository;
    @Mock
    private DocumentTypeRepository documentTypeRepository;
    @Mock
    private TagRepository tagRepository;
    @Mock
    private AuthenticatedUserContext userContext;

    @InjectMocks
    private TenantDepartmentService departmentService;
    @InjectMocks
    private DocumentTypeService documentTypeService;
    @InjectMocks
    private TagService tagService;

    @Test
    void departmentListingAlwaysUsesAuthenticatedTenantAndPageFilters() {
        Pageable pageable = Pageable.ofSize(10);
        when(userContext.requireTenantId()).thenReturn(TENANT_ID);
        when(departmentRepository.findByTenant(TENANT_ID, "legal", true, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        departmentService.find("  legal  ", true, pageable);

        verify(departmentRepository).findByTenant(TENANT_ID, "legal", true, pageable);
    }

    @Test
    void departmentCreateRejectsDuplicateWithoutPersisting() {
        TenantDepartmentRequest request = new TenantDepartmentRequest();
        request.setName("Legal");
        request.setCode("LEGAL");
        when(userContext.requireTenantId()).thenReturn(TENANT_ID);
        when(departmentRepository.existsDuplicate(TENANT_ID, "LEGAL", "Legal", null))
                .thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> departmentService.create(request));
        verify(departmentRepository).existsDuplicate(TENANT_ID, "LEGAL", "Legal", null);
        verifyNoInteractions(documentTypeRepository, tagRepository);
    }

    @Test
    void documentTypeGetDoesNotLeakAnotherTenant() {
        UUID id = UUID.randomUUID();
        when(userContext.requireTenantId()).thenReturn(TENANT_ID);
        when(documentTypeRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> documentTypeService.findById(id));
        verify(documentTypeRepository).findByIdAndTenantId(id, TENANT_ID);
    }

    @Test
    void documentTypeCreateNeverUsesClientTenant() {
        DocumentTypeRequest request = new DocumentTypeRequest();
        request.setName("Contrato");
        request.setCode("CONTRACT");
        when(userContext.requireTenantId()).thenReturn(TENANT_ID);
        when(documentTypeRepository.existsDuplicate(TENANT_ID, "CONTRACT", "Contrato", null))
                .thenReturn(false);
        when(documentTypeRepository.save(any(DocumentType.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        documentTypeService.create(request);

        verify(documentTypeRepository).save(org.mockito.ArgumentMatchers.argThat(
                value -> TENANT_ID.equals(value.getTenantId())));
    }

    @Test
    void tagDeleteScopesLookupBeforeDelete() {
        UUID id = UUID.randomUUID();
        when(userContext.requireTenantId()).thenReturn(TENANT_ID);
        Tag tag = Tag.builder().id(id).tenantId(OTHER_TENANT_ID).name("Privada").build();
        when(tagRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> tagService.delete(id));
        verify(tagRepository).findByIdAndTenantId(id, TENANT_ID);
    }
}
