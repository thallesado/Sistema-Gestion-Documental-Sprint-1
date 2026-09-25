package com.lta.gestdocum.backend.modulos.expedientes.servicio;

import com.lta.gestdocum.backend.modulos.expedientes.dto.ExpedientResponse;
import com.lta.gestdocum.backend.modulos.expedientes.dto.ExpedientCreateRequest;
import com.lta.gestdocum.backend.comun.excepcion.DuplicateResourceException;
import com.lta.gestdocum.backend.comun.excepcion.NotFoundException;
import com.lta.gestdocum.backend.modulos.expedientes.modelo.Expedient;
import com.lta.gestdocum.backend.modulos.expedientes.repositorio.ExpedientRepository;
import com.lta.gestdocum.backend.comun.seguridad.AuthenticatedUserContext;
import com.lta.gestdocum.backend.comun.soporte.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.UUID;
import java.time.OffsetDateTime;
import java.util.Map;

@Service
public class ExpedientService {

    private final ExpedientRepository repository;
    private final AuthenticatedUserContext userContext;

    public ExpedientService(ExpedientRepository repository, AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<ExpedientResponse> find(String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenant(tenantId, CrudTextSupport.likePattern(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ExpedientResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        UUID tenantId = userContext.requireTenantId();
        Expedient expedient = repository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Expediente no encontrado"));
        return toResponse(expedient);
    }

    @Transactional
    @SuppressWarnings("null")
    public ExpedientResponse create(ExpedientCreateRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        OffsetDateTime now = OffsetDateTime.now();
        Expedient expedient = Expedient.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .expedientTypeId(request.expedientTypeId())
                .responsibleId(request.responsibleId())
                .departmentId(request.departmentId())
                .code(request.code().trim())
                .name(request.name().trim())
                .description(request.description() == null || request.description().isBlank()
                        ? null : request.description().trim())
                .status(Expedient.ExpedientStatus.ACTIVE)
                .metadata(request.metadata() == null ? Map.of() : request.metadata())
                .createdAt(now)
                .updatedAt(now)
                .build();
        try {
            return toResponse(repository.save(expedient));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException(
                    "El código de expediente ya existe o referencia datos inválidos");
        }
    }

    private ExpedientResponse toResponse(Expedient expedient) {
        return new ExpedientResponse(
                expedient.getId(),
                expedient.getExpedientTypeId(),
                expedient.getResponsibleId(),
                expedient.getDepartmentId(),
                expedient.getCode(),
                expedient.getName(),
                expedient.getDescription(),
                expedient.getStatus(),
                expedient.getMetadata(),
                expedient.getClosedAt(),
                expedient.getArchivedAt(),
                expedient.getCreatedAt(),
                expedient.getUpdatedAt());
    }
}
