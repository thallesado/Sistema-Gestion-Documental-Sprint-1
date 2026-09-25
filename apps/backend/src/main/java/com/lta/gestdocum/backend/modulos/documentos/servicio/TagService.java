package com.lta.gestdocum.backend.modulos.documentos.servicio;

import com.lta.gestdocum.backend.modulos.documentos.dto.TagRequest;
import com.lta.gestdocum.backend.modulos.documentos.dto.TagResponse;
import com.lta.gestdocum.backend.comun.excepcion.DuplicateResourceException;
import com.lta.gestdocum.backend.comun.excepcion.NotFoundException;
import com.lta.gestdocum.backend.modulos.documentos.modelo.Tag;
import com.lta.gestdocum.backend.modulos.documentos.repositorio.TagRepository;
import com.lta.gestdocum.backend.comun.seguridad.AuthenticatedUserContext;
import com.lta.gestdocum.backend.comun.soporte.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class TagService {

    private final TagRepository repository;
    private final AuthenticatedUserContext userContext;

    public TagService(TagRepository repository, AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<TagResponse> find(String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenant(tenantId, CrudTextSupport.optionalFilter(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TagResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        return toResponse(getForTenant(id));
    }

    @Transactional
    public TagResponse create(TagRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String name = CrudTextSupport.required(request.getName(), "name");
        ensureUnique(tenantId, name, null);
        Tag tag = Tag.builder()
                .tenantId(tenantId)
                .name(name)
                .color(trimToNull(request.getColor()))
                .createdAt(OffsetDateTime.now())
                .build();
        return toResponse(repository.save(tag));
    }

    @Transactional
    public TagResponse update(UUID id, TagRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        Tag tag = getForTenant(id);
        String name = request.getName() == null
                ? tag.getName()
                : CrudTextSupport.required(request.getName(), "name");
        ensureUnique(tenantId, name, id);
        tag.setName(name);
        if (request.getColor() != null) {
            tag.setColor(trimToNull(request.getColor()));
        }
        return toResponse(repository.save(tag));
    }

    @Transactional
    public void delete(UUID id) {
        userContext.establishDatabaseContext();
        Tag tag = getForTenant(id);
        repository.delete(tag);
    }

    private Tag getForTenant(UUID id) {
        return repository.findByIdAndTenantId(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Etiqueta no encontrada"));
    }

    private void ensureUnique(UUID tenantId, String name, UUID excludedId) {
        if (repository.existsDuplicate(tenantId, name, excludedId)) {
            throw new DuplicateResourceException("El nombre de la etiqueta ya existe");
        }
    }

    private TagResponse toResponse(Tag tag) {
        return TagResponse.builder()
                .id(tag.getId())
                .name(tag.getName())
                .color(tag.getColor())
                .createdAt(tag.getCreatedAt())
                .build();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
