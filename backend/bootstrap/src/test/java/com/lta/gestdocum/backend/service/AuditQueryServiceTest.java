package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditEventFilter;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import java.net.InetAddress;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditQueryServiceTest {

    @Mock
    private AuditEventRepository repository;

    @Mock
    private AuthenticatedUserContext context;

    @InjectMocks
    private AuditQueryService service;

    @Test
    @DisplayName("AuditEventResponse mapea correctamente details, clientTimestamp y clientTimezone")
    void testAuditEventResponseFrom() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime clientTs = now.minusSeconds(10);

        AuditEvent event = AuditEvent.builder()
                .id(123L)
                .tenantId(tenantId)
                .userId(userId)
                .action("CREATE")
                .entityType("DOCUMENTS")
                .entityId(entityId)
                .occurredAt(now)
                .clientTimestamp(clientTs)
                .clientTimezone("America/La_Paz")
                .result("SUCCESS")
                .ipAddress(InetAddress.getByName("127.0.0.1"))
                .userAgent("Chrome")
                .details("{\"before\":null,\"after\":{\"code\":\"DOC-1\"}}")
                .build();

        AuditEventResponse response = AuditEventResponse.from(event);

        assertEquals(123L, response.id());
        assertEquals("CREATE", response.action());
        assertEquals("DOCUMENTS", response.entityType());
        assertEquals(entityId, response.entityId());
        assertEquals(clientTs, response.clientTimestamp());
        assertEquals("America/La_Paz", response.clientTimezone());
        assertEquals("{\"before\":null,\"after\":{\"code\":\"DOC-1\"}}", response.details());
        assertEquals("127.0.0.1", response.ipAddress());
    }

    @Test
    @DisplayName("list aplica filtros y devuelve resultados paginados mapeados")
    void testListWithFilters() {
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), tenantId, "diego", Set.of("ROLE_ADMIN"));
        when(context.require()).thenReturn(user);

        AuditEvent event = AuditEvent.builder()
                .id(1L)
                .tenantId(tenantId)
                .action("HTTP_POST")
                .entityType("DOCUMENTS")
                .occurredAt(OffsetDateTime.now())
                .result("SUCCESS")
                .details("{}")
                .build();

        when(repository.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(event)));

        AuditEventFilter filter = new AuditEventFilter("HTTP_POST,CREATE", "DOCUMENTS", "SUCCESS", null, null);
        Page<AuditEventResponse> result = service.list(filter, PageRequest.of(0, 10));

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals("HTTP_POST", result.getContent().get(0).action());
    }
}
