package com.lta.gestdocum.backend.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * El sello HMAC del ancla solo prueba algo si el secreto no es público. El valor por defecto está en el
 * repositorio: con un destino externo configurado en producción, usarlo equivale a no tener ancla, así que el
 * arranque se detiene. En otros perfiles solo se advierte.
 */
@Component
public class AuditAnchorSecretGuard {

    static final String DEFAULT_SECRET = "nexodocs-tamper-proof-anchor-master-key-2026";
    private static final Logger log = LoggerFactory.getLogger(AuditAnchorSecretGuard.class);

    private final String secret;
    private final AuditAnchorExternalGateway gateway;
    private final Environment environment;

    @Autowired
    public AuditAnchorSecretGuard(
            @Value("${nexodocs.audit.anchor-secret:" + DEFAULT_SECRET + "}") String secret,
            AuditAnchorExternalGateway gateway,
            Environment environment) {
        this.secret = secret;
        this.gateway = gateway;
        this.environment = environment;
    }

    @PostConstruct
    void verify() {
        check(secret, gateway.isConfigured(), environment.acceptsProfiles(Profiles.of("prod")));
    }

    static void check(String secret, boolean destinationConfigured, boolean prod) {
        if (!DEFAULT_SECRET.equals(secret)) {
            return;
        }
        if (destinationConfigured && prod) {
            throw new IllegalStateException(
                    "AUDIT_ANCHOR_SECRET still has the public default value while an external audit anchor destination is configured; set your own secret.");
        }
        log.warn("AUDIT_ANCHOR_SECRET has the public default value: anchor signatures can be forged. Set your own secret before relying on audit anchors.");
    }
}
