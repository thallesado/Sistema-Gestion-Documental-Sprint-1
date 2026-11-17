package com.lta.gestdocum.backend.security;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/** Vectores del RFC 6238 (SHA-1, secreto "12345678901234567890"), truncados a 6 dígitos. */
class TotpTest {
    private static final String SECRET = Totp.base32("12345678901234567890".getBytes(StandardCharsets.US_ASCII));

    @Test
    void matchesTheRfcVectors() {
        assertEquals("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", SECRET);
        assertEquals("287082", Totp.code(SECRET, Totp.step(59)));
        assertEquals("081804", Totp.code(SECRET, Totp.step(1111111109)));
        assertEquals("005924", Totp.code(SECRET, Totp.step(1234567890)));
        assertEquals("279037", Totp.code(SECRET, Totp.step(2000000000)));
    }

    @Test
    void acceptsOneStepOfClockDriftAndNothingMore() {
        long now = 1234567890;
        String previous = Totp.code(SECRET, Totp.step(now) - 1);
        assertEquals(Totp.step(now) - 1, Totp.matchingStep(SECRET, previous, now, null));
        String old = Totp.code(SECRET, Totp.step(now) - 3);
        assertEquals(-1, Totp.matchingStep(SECRET, old, now, null));
    }

    @Test
    void aCodeCannotBeUsedTwice() {
        long now = 1234567890;
        String code = Totp.code(SECRET, Totp.step(now));
        long step = Totp.matchingStep(SECRET, code, now, null);
        assertTrue(step > 0);
        assertEquals(-1, Totp.matchingStep(SECRET, code, now, step));
    }

    @Test
    void rejectsMalformedCodes() {
        assertEquals(-1, Totp.matchingStep(SECRET, null, 59, null));
        assertEquals(-1, Totp.matchingStep(SECRET, "12345", 59, null));
        assertEquals(-1, Totp.matchingStep(SECRET, "abcdef", 59, null));
        assertEquals(Totp.step(59), Totp.matchingStep(SECRET, "287 082", 59, null));
    }

    @Test
    void newSecretsRoundTripAndBuildAnOtpauthUri() {
        String secret = Totp.newSecret();
        assertEquals(32, secret.length());
        assertEquals(20, Totp.fromBase32(secret).length);
        String uri = Totp.otpauthUri("NexoDocs", "admin@nexodocs.test", secret);
        assertTrue(uri.startsWith("otpauth://totp/NexoDocs:admin%40nexodocs.test?secret=" + secret));
        assertTrue(uri.contains("&digits=6&period=30"));
    }
}
