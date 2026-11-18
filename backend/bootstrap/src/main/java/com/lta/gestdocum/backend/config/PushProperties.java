package com.lta.gestdocum.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Credenciales de Firebase Cloud Messaging (variables documentadas en .env.example).
 * Se usa FIREBASE_CREDENTIALS_PATH (ruta del JSON de la cuenta de servicio) o FIREBASE_CREDENTIALS_JSON
 * (contenido del JSON). Sin ninguna de las dos, los avisos push quedan desactivados.
 */
@Component
public class PushProperties {

    private final String credentialsPath;
    private final String credentialsJson;

    public PushProperties(
            @Value("${nexodocs.push.firebase.credentials-path:}") String credentialsPath,
            @Value("${nexodocs.push.firebase.credentials-json:}") String credentialsJson) {
        this.credentialsPath = credentialsPath == null ? "" : credentialsPath.trim();
        this.credentialsJson = credentialsJson == null ? "" : credentialsJson.trim();
    }

    public String credentialsPath() { return credentialsPath; }

    public String credentialsJson() { return credentialsJson; }

    public boolean credentialsConfigured() {
        return !credentialsPath.isEmpty() || !credentialsJson.isEmpty();
    }
}
