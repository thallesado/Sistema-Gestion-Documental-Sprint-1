package com.lta.gestdocum.backend.billing;

import com.lta.gestdocum.backend.model.BillingTransaction;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class BankQrGatewayProvider implements PaymentGatewayProvider {
    public BillingTransaction.PaymentMethod method() { return BillingTransaction.PaymentMethod.BANK_QR; }
    public GatewayPayment initiate(UUID id, BigDecimal amount, BillingTransaction.BillingCycle cycle, String ignored) {
        String reference = "NEXO-QR-" + id.toString().substring(0, 8).toUpperCase();
        Instant expires = Instant.now().plusSeconds(1_800);
        return new GatewayPayment(reference, expires, Map.of("qrPayload", "NEXODOCS|" + reference + "|USD|" + amount,
                "bank", "NexoBank Sandbox", "gloss", "NexoDocs " + cycle, "expiresAt", expires.toString(), "mode", "sandbox"));
    }
    public boolean confirm(String reference, String confirmation) {
        return reference.matches("NEXO-QR-[A-F0-9]{8}") && reference.equals(confirmation);
    }
}
