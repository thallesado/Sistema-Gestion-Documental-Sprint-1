package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ExpedientResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Expedient;
import com.lta.gestdocum.backend.model.Expedient.ExpedientStatus;
import com.lta.gestdocum.backend.repository.ExpedientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpedientServiceTest {

    @Mock
    private ExpedientRepository repository;

    @Mock
    private AuthenticatedUserContext userContext;

    @Mock
    private JdbcTemplate jdbc;

    @InjectMocks
    private ExpedientService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID expedientId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
    }

    private Expedient buildActiveExpedient() {
        OffsetDateTime now = OffsetDateTime.now();
        return Expedient.builder()
                .id(expedientId)
                .tenantId(tenantId)
                .expedientTypeId(UUID.randomUUID())
                .code("EXP-2026-001")
                .name("Expediente de Prueba")
                .description("Descripción")
                .status(ExpedientStatus.ACTIVE)
                .metadata(Map.of())
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    @DisplayName("find() should delegate to findByTenantAndStatus with given status and filter")
    void shouldFindExpedientsWithStatusFilter() {
        PageRequest pageable = PageRequest.of(0, 10);
        Expedient expedient = buildActiveExpedient();
        when(repository.findByTenantAndStatus(eq(tenantId), eq(ExpedientStatus.ACTIVE), eq("%auditoria%"), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(expedient)));

        Page<ExpedientResponse> result = service.find("auditoria", ExpedientStatus.ACTIVE, pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(expedientId, result.getContent().get(0).id());
        verify(userContext).establishDatabaseContext();
    }

    @Test
    @DisplayName("close() should transition active expedient to CLOSED and record closedAt timestamp")
    void shouldCloseExpedientSuccessfully() {
        Expedient expedient = buildActiveExpedient();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(expedientId, tenantId))
                .thenReturn(Optional.of(expedient));
        when(repository.save(any(Expedient.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpedientResponse response = service.close(expedientId);

        ArgumentCaptor<Expedient> captor = ArgumentCaptor.forClass(Expedient.class);
        verify(repository).save(captor.capture());
        Expedient saved = captor.getValue();

        assertEquals(ExpedientStatus.CLOSED, saved.getStatus());
        assertNotNull(saved.getClosedAt(), "closedAt debe ser establecido al cerrar");
        assertEquals(ExpedientStatus.CLOSED, response.status());
        assertNotNull(response.closedAt());
    }

    @Test
    @DisplayName("archive() should transition expedient to ARCHIVED and record archivedAt and closedAt timestamps")
    void shouldArchiveExpedientSuccessfully() {
        Expedient expedient = buildActiveExpedient();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(expedientId, tenantId))
                .thenReturn(Optional.of(expedient));
        when(repository.save(any(Expedient.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpedientResponse response = service.archive(expedientId);

        ArgumentCaptor<Expedient> captor = ArgumentCaptor.forClass(Expedient.class);
        verify(repository).save(captor.capture());
        Expedient saved = captor.getValue();

        assertEquals(ExpedientStatus.ARCHIVED, saved.getStatus());
        assertNotNull(saved.getArchivedAt(), "archivedAt debe ser establecido al archivar");
        assertNotNull(saved.getClosedAt(), "closedAt no debe ser nulo si el expediente se archiva");
        assertEquals(ExpedientStatus.ARCHIVED, response.status());
    }

    @Test
    @DisplayName("reopen() should transition closed expedient back to ACTIVE and clear close timestamps")
    void shouldReopenExpedientSuccessfully() {
        Expedient expedient = buildActiveExpedient();
        expedient.setStatus(ExpedientStatus.CLOSED);
        expedient.setClosedAt(OffsetDateTime.now());

        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(expedientId, tenantId))
                .thenReturn(Optional.of(expedient));
        when(repository.save(any(Expedient.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpedientResponse response = service.reopen(expedientId);

        ArgumentCaptor<Expedient> captor = ArgumentCaptor.forClass(Expedient.class);
        verify(repository).save(captor.capture());
        Expedient saved = captor.getValue();

        assertEquals(ExpedientStatus.ACTIVE, saved.getStatus());
        assertNull(saved.getClosedAt(), "closedAt debe limpiarse al reabrir");
        assertNull(saved.getArchivedAt(), "archivedAt debe limpiarse al reabrir");
        assertEquals(ExpedientStatus.ACTIVE, response.status());
    }

    @Test
    @DisplayName("updateStatus() should throw NotFoundException when expedient does not exist or belongs to another tenant")
    void shouldThrowNotFoundWhenExpedientDoesNotExist() {
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(expedientId, tenantId))
                .thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.close(expedientId));
        verify(repository, never()).save(any());
    }
}
