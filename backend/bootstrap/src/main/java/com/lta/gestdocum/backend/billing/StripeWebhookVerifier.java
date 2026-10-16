package com.lta.gestdocum.backend.billing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Validates Stripe's signed payload format: t=timestamp,v1=HMAC_SHA256(timestamp.payload). */
@Component
public class StripeWebhookVerifier {
    private static final String PLACEHOLDER = "whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET";
    private final String webhookSecret;

    public StripeWebhookVerifier(@Value("${app.stripe.webhook-secret:" + PLACEHOLDER + "}") String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public void verify(String payload, String signatureHeader) {
        if (webhookSecret == null || webhookSecret.isBlank() || PLACEHOLDER.equals(webhookSecret)) {
            throw new AccessDeniedException("El webhook de Stripe no está configurado");
        }
        Map<String, String> values = parse(signatureHeader);
        long timestamp;
        try { timestamp = Long.parseLong(values.get("t")); }
        catch (RuntimeException exception) { throw new AccessDeniedException("Firma Stripe inválida"); }
        if (Math.abs(Instant.now().getEpochSecond() - timestamp) > 300) {
            throw new AccessDeniedException("Firma Stripe expirada");
        }
        String expected = hmac(timestamp + "." + payload);
        String supplied = values.get("v1");
        if (supplied == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
            throw new AccessDeniedException("Firma Stripe inválida");
        }
    }

    private Map<String, String> parse(String header) {
        Map<String, String> values = new HashMap<>();
        if (header == null) return values;
        for (String part : header.split(",")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2 && !values.containsKey(pair[0])) values.put(pair[0], pair[1]);
        }
        return values;
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("No se pudo validar la firma Stripe", exception);
        }
    }
}
