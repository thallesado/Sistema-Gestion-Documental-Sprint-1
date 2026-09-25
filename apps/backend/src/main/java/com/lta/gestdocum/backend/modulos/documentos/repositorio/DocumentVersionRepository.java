package com.lta.gestdocum.backend.modulos.documentos.repositorio;

import com.lta.gestdocum.backend.modulos.documentos.modelo.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {
    List<DocumentVersion> findByTenantIdAndDocumentIdOrderByVersionNumberDesc(UUID tenantId, UUID documentId);
    Optional<DocumentVersion> findByIdAndTenantId(UUID id, UUID tenantId);
}
