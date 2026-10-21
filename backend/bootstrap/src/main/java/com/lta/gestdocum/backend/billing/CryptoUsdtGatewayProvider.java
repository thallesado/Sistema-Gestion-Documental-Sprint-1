package com.lta.gestdocum.backend.billing;

import com.lta.gestdocum.backend.model.BillingTransaction;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class CryptoUsdtGatewayProvider implements PaymentGatewayProvider {
    public BillingTransaction.PaymentMethod method() { return BillingTransaction.PaymentMethod.CRYPTO_USDT; }
    public GatewayPayment initiate(UUID id, BigDecimal amount, BillingTransaction.BillingCycle cycle, String requestedNetwork) {
        String network = "POLYGON".equalsIgnoreCase(requestedNetwork) ? "POLYGON" : "TRC20";
        String wallet = network.equals("POLYGON") ? "0xNEXOdocsSandboxPolygon" : "TSandboxNexoDocsUSDT";
        String reference = "sandbox_usdt_" + id.toString().replace("-", "");
        return new GatewayPayment(reference, Instant.now().plusSeconds(1_800), Map.of("network", network, "wallet", wallet,
                "amountUsdt", amount, "qrPayload", "usdt:" + wallet + "?amount=" + amount + "&memo=" + reference, "mode", "sandbox"));
    }
    public boolean confirm(String reference, String confirmation) {
        if (!reference.startsWith("sandbox_usdt_") || confirmation == null) return false;
        return confirmation.matches("(?:0x)?[A-Fa-f0-9]{64}")
                || confirmation.matches("sandbox_tx_[A-Za-z0-9_-]{8,128}");
    }
}
