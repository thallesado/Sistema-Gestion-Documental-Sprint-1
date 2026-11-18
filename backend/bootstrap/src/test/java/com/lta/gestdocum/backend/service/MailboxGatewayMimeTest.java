package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * mail_intake_items.mime_type es varchar(150). Un Content-Type más largo hacía fallar el INSERT, se revertía
 * todo el lote y el cursor no avanzaba: un solo correo bloqueaba el buzón en cada sincronización.
 */
class MailboxGatewayMimeTest {

    @Test
    void conservaElTipoSinParametros() {
        assertEquals("application/pdf", MailboxGateway.normalizeMime("Application/PDF; name=\"acta.pdf\""));
    }

    @Test
    void unTipoDemasiadoLargoSeGuardaComoBinarioGenerico() {
        String hostile = "application/" + "x".repeat(200);
        assertEquals("application/octet-stream", MailboxGateway.normalizeMime(hostile));
    }

    @Test
    void vacioONuloSeGuardaComoBinarioGenerico() {
        assertEquals("application/octet-stream", MailboxGateway.normalizeMime(null));
        assertEquals("application/octet-stream", MailboxGateway.normalizeMime("  ;charset=utf-8"));
    }
}
