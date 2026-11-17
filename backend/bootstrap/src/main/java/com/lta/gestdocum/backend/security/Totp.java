package com.lta.gestdocum.backend.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Códigos de un solo uso basados en tiempo (RFC 6238): HMAC-SHA1, pasos de 30 segundos y 6 dígitos, los
 * valores que usan Google Authenticator, Microsoft Authenticator y similares. Funciones puras y probadas.
 */
public final class Totp {
    public static final int STEP_SECONDS = 30;
    public static final int DIGITS = 6;
    /** Pasos de tolerancia a cada lado por el desfase de reloj del teléfono. */
    public static final int WINDOW = 1;
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() { }

    /** Secreto nuevo de 160 bits en Base32 (sin relleno). */
    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    public static long step(long epochSeconds) { return Math.floorDiv(epochSeconds, STEP_SECONDS); }

    public static String code(String secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(fromBase32(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
            return String.format("%0" + DIGITS + "d", binary % 1_000_000);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HmacSHA1 no disponible", exception);
        }
    }

    /**
     * Paso que coincide con el código dentro de la ventana, o -1. Un paso igual o anterior a lastUsedStep
     * no se acepta: un código ya usado no sirve dos veces.
     */
    public static long matchingStep(String secret, String code, long epochSeconds, Long lastUsedStep) {
        if (code == null) return -1;
        String digits = code.replaceAll("\\s", "");
        if (!digits.matches("\\d{" + DIGITS + "}")) return -1;
        long current = step(epochSeconds);
        long matched = -1;
        for (long candidate = current - WINDOW; candidate <= current + WINDOW; candidate++) {
            // Se comparan todos los pasos en tiempo constante para no filtrar cuál coincidió.
            boolean equal = MessageDigest.isEqual(code(secret, candidate).getBytes(StandardCharsets.US_ASCII),
                    digits.getBytes(StandardCharsets.US_ASCII));
            if (equal && (lastUsedStep == null || candidate > lastUsedStep)) matched = candidate;
        }
        return matched;
    }

    /** URI que las aplicaciones de autenticación importan (y que se puede convertir en QR). */
    public static String otpauthUri(String issuer, String account, String secret) {
        String label = encode(issuer) + ":" + encode(account);
        return "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + encode(issuer)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        return out.toString();
    }

    static byte[] fromBase32(String text) {
        String clean = text.replace("=", "").replace(" ", "").toUpperCase(java.util.Locale.ROOT);
        ByteBuffer out = ByteBuffer.allocate(clean.length() * 5 / 8);
        int buffer = 0;
        int bits = 0;
        for (char c : clean.toCharArray()) {
            int value = BASE32.indexOf(c);
            if (value < 0) throw new IllegalArgumentException("Secreto Base32 inválido");
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) ((buffer >> (bits - 8)) & 0xff));
                bits -= 8;
            }
        }
        return out.array();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
