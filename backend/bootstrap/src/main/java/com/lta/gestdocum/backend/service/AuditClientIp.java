package com.lta.gestdocum.backend.service;

import java.net.InetAddress;
import java.util.regex.Pattern;

/**
 * IP de origen para {@code audit_events.ip_address} (columna {@code inet}). Un {@code X-Forwarded-For} con un
 * valor que no es una IP hacía fallar {@code cast(:ip as inet)} y el evento no se guardaba: cualquiera podía
 * mutar datos sin dejar rastro enviando esa cabecera. Ahora un valor inválido se descarta y se usa la IP de la
 * conexión.
 */
public final class AuditClientIp {

    static final String UNKNOWN = "0.0.0.0";
    /** Solo caracteres de un literal IPv4/IPv6: evita que InetAddress resuelva nombres por DNS. */
    private static final Pattern IP_LITERAL = Pattern.compile("[0-9a-fA-F:.]{2,45}");

    private AuditClientIp() {
    }

    /** Primera IP válida entre la cabecera reenviada (primer elemento) y la dirección remota. */
    public static String resolve(String forwardedFor, String remoteAddr) {
        String forwarded = firstEntry(forwardedFor);
        if (isIp(forwarded)) return forwarded;
        String remote = firstEntry(remoteAddr);
        return isIp(remote) ? remote : UNKNOWN;
    }

    static boolean isIp(String value) {
        if (value == null || !IP_LITERAL.matcher(value).matches()) return false;
        if (value.indexOf(':') < 0) return isIpv4(value);
        // Con ':' InetAddress lo trata como literal IPv6 y no consulta DNS.
        try {
            InetAddress.getByName(value);
            return true;
        } catch (Exception invalid) {
            return false;
        }
    }

    private static boolean isIpv4(String value) {
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) return false;
        for (String part : parts) {
            if (part.isEmpty() || part.length() > 3 || !part.chars().allMatch(Character::isDigit)) return false;
            if (Integer.parseInt(part) > 255) return false;
        }
        return true;
    }

    private static String firstEntry(String value) {
        if (value == null || value.isBlank()) return null;
        int comma = value.indexOf(',');
        return (comma < 0 ? value : value.substring(0, comma)).trim();
    }
}
