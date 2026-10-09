package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ExpedientResponse;
import com.lta.gestdocum.backend.dto.ExpedientCreateRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Expedient;
import com.lta.gestdocum.backend.repository.ExpedientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;

@Service
public class ExpedientService {

    private final ExpedientRepository repository;
    private final AuthenticatedUserContext userContext;
    private final JdbcTemplate jdbc;

    public ExpedientService(ExpedientRepository repository, AuthenticatedUserContext userContext, JdbcTemplate jdbc) {
        this.repository = repository;
        this.userContext = userContext;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Page<ExpedientResponse> find(String filter, Pageable pageable) {
        return find(filter, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<ExpedientResponse> find(String filter, Expedient.ExpedientStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenantAndStatus(tenantId, status, CrudTextSupport.likePattern(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional
    public ExpedientResponse updateStatus(UUID id, Expedient.ExpedientStatus targetStatus) {
        if (targetStatus == null) {
            throw new IllegalArgumentException("El estado destino no puede ser nulo");
        }
        userContext.establishDatabaseContext();
        UUID tenantId = userContext.requireTenantId();
        Expedient expedient = repository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Expediente no encontrado"));

        OffsetDateTime now = OffsetDateTime.now();
        expedient.setStatus(targetStatus);
        expedient.setUpdatedAt(now);

        switch (targetStatus) {
            case CLOSED -> expedient.setClosedAt(now);
            case ARCHIVED -> {
                expedient.setArchivedAt(now);
                if (expedient.getClosedAt() == null) {
                    expedient.setClosedAt(now);
                }
            }
            case ACTIVE -> {
                expedient.setClosedAt(null);
                expedient.setArchivedAt(null);
            }
            case BLOCKED -> {
                // Conserva marcas temporales
            }
        }

        return toResponse(repository.save(expedient));
    }

    @Transactional
    public ExpedientResponse close(UUID id) {
        return updateStatus(id, Expedient.ExpedientStatus.CLOSED);
    }

    @Transactional
    public ExpedientResponse archive(UUID id) {
        return updateStatus(id, Expedient.ExpedientStatus.ARCHIVED);
    }

    @Transactional
    public ExpedientResponse reopen(UUID id) {
        return updateStatus(id, Expedient.ExpedientStatus.ACTIVE);
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
        Map<String, Object> metadata = normalizeMetadata(request.metadata(), tenantId);
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
                .metadata(metadata)
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

    private Map<String, Object> normalizeMetadata(Map<String, Object> input, UUID tenantId) {
        Map<String, Object> metadata = new LinkedHashMap<>(input == null ? Map.of() : input);
        Object rawParticipants = metadata.get("participants");
        if (rawParticipants == null) return metadata;
        if (!(rawParticipants instanceof List<?> participants) || participants.size() > 100) {
            throw new IllegalArgumentException("La lista de participantes no es válida");
        }
        List<Map<String, Object>> validated = new ArrayList<>();
        for (Object raw : participants) {
            if (!(raw instanceof Map<?, ?> item)) throw new IllegalArgumentException("Participante no válido");
            String source = String.valueOf(item.get("source")).trim().toUpperCase();
            String name = item.get("name") == null ? "" : String.valueOf(item.get("name")).trim();
            String role = item.get("role") == null ? "" : String.valueOf(item.get("role")).trim();
            if (name.isBlank() || name.length() > 200 || role.isBlank() || role.length() > 80) {
                throw new IllegalArgumentException("Cada participante debe tener nombre y función válidos");
            }
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("source", source);
            if (source.equals("USER") || source.equals("PATIENT")) {
                UUID sourceId;
                try { sourceId = UUID.fromString(String.valueOf(item.get("sourceId"))); }
                catch (RuntimeException invalidId) { throw new IllegalArgumentException("Participante registrado no válido"); }
                String table = source.equals("USER") ? "users" : "patients";
                String activeCondition = source.equals("USER") ? "status = 'ACTIVE'" : "status = 'ACTIVE' AND deleted_at IS NULL";
                String actualName = jdbc.query("SELECT trim(first_name || ' ' || last_name) FROM " + table
                                + " WHERE tenant_id = ? AND id = ? AND " + activeCondition,
                        result -> result.next() ? result.getString(1) : null, tenantId, sourceId);
                if (actualName == null) throw new IllegalArgumentException("El usuario o paciente ya no está activo en este tenant");
                normalized.put("sourceId", sourceId.toString());
                normalized.put("name", actualName);
                normalized.put("role", source.equals("PATIENT") ? "Paciente" : role);
            } else if (source.equals("CUSTOM")) {
                normalized.put("name", name);
                normalized.put("role", role);
            } else {
                throw new IllegalArgumentException("Tipo de participante no permitido");
            }
            validated.add(normalized);
        }
        metadata.put("participants", validated);
        return metadata;
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
