package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.PublicRadicacionResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.TransactionStatus;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PublicRadicacionServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    private PublicRadicacionService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        PlatformTransactionManager txManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) throws TransactionException {
                return mock(TransactionStatus.class);
            }

            @Override
            public void commit(TransactionStatus status) throws TransactionException {}

            @Override
            public void rollback(TransactionStatus status) throws TransactionException {}
        };

        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory();
        beanFactory.addBean("jdbcTemplate", jdbc);

        service = new PublicRadicacionService(
                beanFactory.getBeanProvider(JdbcTemplate.class),
                txManager,
                objectMapper
        );
    }

    @Test
    void consultarRadicacion_exigeTenantYCodigo() {
        assertThrows(IllegalArgumentException.class, () -> service.consultarRadicacion(null, "RAD-2026-000001"));
        assertThrows(IllegalArgumentException.class, () -> service.consultarRadicacion(UUID.randomUUID(), "   "));
    }

    @Test
    void consultarRadicacion_retornaDetallesPublicosYHashValido() {
        UUID tenantId = UUID.randomUUID();
        String code = "RAD-2026-000001";
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        when(jdbc.query(contains("FROM tenants"), any(RowMapper.class), eq(tenantId)))
                .thenReturn(List.of("Empresa Pública Demo"));

        when(jdbc.query(contains("FROM expedients"), any(RowMapper.class), eq(tenantId), eq(code)))
                .thenReturn(List.of(Map.of(
                        "id", UUID.randomUUID(),
                        "code", code,
                        "name", "Solicitud de información pública",
                        "description", "Requiero copia del acta 102",
                        "status", "ACTIVE",
                        "metadata", "{\"citizen\":{\"fullName\":\"Carlos Mendoza\"},\"radicacionType\":\"PETICION\"}",
                        "created_at", now
                )));

        PublicRadicacionResponse response = service.consultarRadicacion(tenantId, code);

        assertNotNull(response);
        assertEquals(code, response.code());
        assertEquals("Empresa Pública Demo", response.tenantName());
        assertEquals("Solicitud de información pública", response.subject());
        assertEquals("PETICION", response.type());
        assertEquals("Carlos Mendoza", response.citizenName());
        assertEquals("ACTIVE", response.status());
        assertEquals("En Trámite", response.statusLabel());
        assertNotNull(response.verificationHash());
        assertEquals(64, response.verificationHash().length());
        assertFalse(response.events().isEmpty());
    }

    @Test
    void consultarRadicacion_siNoExisteLanzaNotFound() {
        UUID tenantId = UUID.randomUUID();
        String code = "RAD-9999-999999";

        when(jdbc.query(contains("FROM tenants"), any(RowMapper.class), eq(tenantId)))
                .thenReturn(List.of("Empresa Pública Demo"));

        when(jdbc.query(contains("FROM expedients"), any(RowMapper.class), eq(tenantId), eq(code)))
                .thenReturn(Collections.emptyList());

        assertThrows(NotFoundException.class, () -> service.consultarRadicacion(tenantId, code));
    }
}
