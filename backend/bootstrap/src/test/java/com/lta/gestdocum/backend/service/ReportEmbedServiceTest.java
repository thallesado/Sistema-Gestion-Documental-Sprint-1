package com.lta.gestdocum.backend.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ReportEmbedServiceTest {

    private static final UUID TENANT = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID USER = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static ReportEmbedService service(String apiKey) {
        // Puerto cerrado: si el servicio intentara llamar a ReportIQ, la prueba fallaría con otro error.
        return new ReportEmbedService("http://127.0.0.1:9", "http://127.0.0.1:9", apiKey, new ObjectMapper());
    }

    @Test
    void sinClaveConfiguradaRespondeServicioNoDisponibleSinUsarUnaClavePorDefecto() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service("").getEmbedConfig(TENANT, USER, "viewer"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
    }

    @Test
    void reportIqCaidoRespondeBadGatewaySinDetalleInterno() {
        // 127.0.0.1:9 rechaza la conexión: ReportIQ no está disponible.
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service("clave-de-prueba").getEmbedConfig(TENANT, USER, "viewer"));
        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertEquals("ReportIQ no está disponible en este momento", error.getReason());
        assertFalse(error.getReason().contains("Connection"));
    }

    @Test
    void reportIqCaidoDejaLaCausaEnElLogYNoEnLaRespuesta() {
        Logger logger = (Logger) LoggerFactory.getLogger(ReportEmbedService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertThrows(ResponseStatusException.class,
                    () -> service("clave-de-prueba").getEmbedConfig(TENANT, USER, "viewer"));
            ILoggingEvent event = appender.list.getLast();
            assertNotNull(event.getThrowableProxy());
            assertFalse(event.getFormattedMessage().contains("clave-de-prueba"));
        } finally {
            logger.detachAppender(appender);
        }
    }

    @Test
    void sinOrganizacionNoSeEmiteTokenDeOtroTenant() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service("clave-de-prueba").getEmbedConfig(null, USER, "admin"));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }
}
