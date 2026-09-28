package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.DocumentVersionRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class DocumentStorageServiceTest {
    @TempDir Path storage;

    @Test
    void rejectsExecutableContentBeforeWritingVersion() {
        var documents = mock(DocumentRepository.class);
        var versions = mock(DocumentVersionRepository.class);
        var context = mock(AuthenticatedUserContext.class);
        UUID tenantId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        when(context.requireTenantId()).thenReturn(tenantId);
        when(documents.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId))
                .thenReturn(Optional.of(new Document()));
        var service = new DocumentStorageService(storage.toString(), documents, versions,
                context, mock(EntityManager.class));

        assertThatThrownBy(() -> service.upload(documentId,
                new MockMultipartFile("file", "malware.exe", "application/octet-stream", new byte[]{1}),
                "Carga inicial")).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Tipo de archivo");
        verifyNoInteractions(versions);
    }

    @Test
    void storesAllowedFileWithSha256AndDatabaseVersion() {
        var documents = mock(DocumentRepository.class);
        var versions = mock(DocumentVersionRepository.class);
        var context = mock(AuthenticatedUserContext.class);
        var entityManager = mock(EntityManager.class);
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        when(context.requireTenantId()).thenReturn(tenantId);
        when(context.requireUserId()).thenReturn(userId);
        when(documents.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId))
                .thenReturn(Optional.of(new Document()));
        doAnswer(invocation -> {
            com.lta.gestdocum.backend.model.DocumentVersion version = invocation.getArgument(0);
            version.setVersionNumber(1);
            return null;
        }).when(entityManager).refresh(any());
        var service = new DocumentStorageService(storage.toString(), documents, versions,
                context, entityManager);

        var result = service.upload(documentId,
                new MockMultipartFile("file", "informe.pdf", "application/pdf", "PDF".getBytes()),
                "Carga inicial");

        assertThat(result.versionNumber()).isEqualTo(1);
        assertThat(result.checksumSha256()).hasSize(64);
        assertThat(result.fileName()).isEqualTo("informe.pdf");
    }
}
