package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuditActorResponse;
import com.lta.gestdocum.backend.dto.AuditEventFilter;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.dto.AuditResourceResponse;
import com.lta.gestdocum.backend.service.AuditQueryUseCase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuditControllerMockMvcTest {
    private CapturingAuditQueryUseCase auditQuery;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        auditQuery = new CapturingAuditQueryUseCase();
        mockMvc = MockMvcBuilders.standaloneSetup(new AuditController(auditQuery))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }

    @Test
    void exposesPersistentAccessAuditFieldsAndForwardsSafeFilters() throws Exception {
        mockMvc.perform(get("/api/v1/audit")
                        .param("action", "HTTP_GET")
                        .param("type", "DOCUMENT")
                        .param("result", "SUCCESS")
                        .param("from", "2026-09-01T00:00:00Z")
                        .param("to", "2026-09-02T00:00:00Z")
                        .param("page", "1")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].occurredAt").value("2026-09-01T10:15:30Z"))
                .andExpect(jsonPath("$.content[0].ipAddress").value("203.0.113.10"))
                .andExpect(jsonPath("$.content[0].userAgent").value("NexoDocs Test"))
                .andExpect(jsonPath("$.content[0].actor.userId").value(auditQuery.actorId.toString()))
                .andExpect(jsonPath("$.content[0].actor.scope").value("TENANT"))
                .andExpect(jsonPath("$.content[0].resource.type").value("DOCUMENT"));

        assertEquals("HTTP_GET", auditQuery.filter.action());
        assertEquals("DOCUMENT", auditQuery.filter.entityType());
        assertEquals("SUCCESS", auditQuery.filter.result());
        assertEquals(OffsetDateTime.parse("2026-09-01T00:00:00Z"), auditQuery.filter.from());
        assertEquals(OffsetDateTime.parse("2026-09-02T00:00:00Z"), auditQuery.filter.to());
        assertEquals(1, auditQuery.pageable.getPageNumber());
        assertEquals(5, auditQuery.pageable.getPageSize());
    }

    private static final class CapturingAuditQueryUseCase implements AuditQueryUseCase {
        private final UUID actorId = UUID.randomUUID();
        private AuditEventFilter filter;
        private Pageable pageable;

        @Override
        public Page<AuditEventResponse> list(AuditEventFilter filter, Pageable pageable) {
            this.filter = filter;
            this.pageable = pageable;
            AuditEventResponse response = new AuditEventResponse(
                    5L, UUID.randomUUID(), actorId, null, "HTTP_GET", "DOCUMENT",
                    UUID.randomUUID(), OffsetDateTime.parse("2026-09-01T10:15:30Z"),
                    "SUCCESS", "203.0.113.10", "NexoDocs Test",
                    new AuditActorResponse(actorId, "TENANT"),
                    new AuditResourceResponse("DOCUMENT", UUID.randomUUID()));
            return new PageImpl<>(List.of(response), PageRequest.of(1, 5), 1);
        }
    }
}
