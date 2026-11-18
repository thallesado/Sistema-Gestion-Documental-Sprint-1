package com.lta.gestdocum.backend.service;

import java.util.Map;

/**
 * Canal de envío de avisos push. La implementación real usa Firebase Cloud Messaging;
 * las pruebas la sustituyen por un cliente simulado.
 */
public interface PushMessageSender {

    /** false si no hay credenciales: el emisor no debe llamarse. */
    boolean isConfigured();

    PushOutcome send(String token, PushMessage message);

    enum PushOutcome {
        SENT,
        /** El token ya no es válido (desinstalado, caducado o mal formado): debe desactivarse. */
        INVALID_TOKEN,
        FAILED
    }

    /** Contenido visible (title/body, mostrado por el sistema) y datos para abrir la tarea. */
    record PushMessage(String title, String body, Map<String, String> data) { }
}
