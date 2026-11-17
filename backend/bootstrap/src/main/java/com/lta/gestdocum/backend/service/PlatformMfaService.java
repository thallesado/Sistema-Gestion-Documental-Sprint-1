package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.Totp;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Doble factor obligatorio de las cuentas de plataforma (066). Tras la contraseña, el login devuelve un
 * desafío (mfaToken de 5 minutos) en lugar de tokens; con el código TOTP correcto se emite la sesión. Sin
 * alta previa, el desafío trae el secreto para registrarlo en la aplicación de autenticación.
 *
 * <p>El secreto se guarda cifrado con AES-GCM (app.mfa.encryption-key, Base64 de 32 bytes; sin ella se
 * deriva de jwt.secret). Un código no sirve dos veces y cinco fallos bloquean la cuenta 15 minutos.
 */
@Service
public class PlatformMfaService {
    static final String PURPOSE_VERIFY = "verify";
    static final String PURPOSE_ENROLL = "enroll";
    private static final long CHALLENGE_MILLIS = 5 * 60_000L;
    private static final int MAX_FAILURES = 5;
    private static final int LOCK_MINUTES = 15;
    private static final String ISSUER = "NexoDocs";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final JwtService jwtService;
    private final SecretKeySpec key;
    private final boolean required;

    public PlatformMfaService(JdbcTemplate jdbc, JwtService jwtService,
                              @Value("${app.mfa.encryption-key:}") String encryptionKey,
                              @Value("${jwt.secret}") String jwtSecret,
                              @Value("${app.platform.mfa-required:true}") boolean required) {
        this.jdbc = jdbc;
        this.jwtService = jwtService;
        this.key = new SecretKeySpec(keyBytes(encryptionKey, jwtSecret), "AES");
        this.required = required;
    }

    public boolean required() { return required; }

    /** Desafío tras una contraseña correcta: verificación si ya tiene MFA; alta con secreto nuevo si no. */
    @Transactional
    public AuthResponse challenge(User user) {
        Map<String, Object> mfa = row(user.getId());
        if (mfa != null && mfa.get("enabled_at") != null) {
            assertNotLocked(mfa);
            return AuthResponse.mfaChallenge(jwtService.generateMfaToken(user.getId(), user.getUsername(), PURPOSE_VERIFY, CHALLENGE_MILLIS),
                    false, null, null);
        }
        String secret = Totp.newSecret();
        jdbc.update("""
                insert into platform_user_mfa (user_id, secret_enc, enabled_at, failed_attempts, updated_at) values (?, ?, null, 0, now())
                on conflict (user_id) do update set secret_enc = excluded.secret_enc, enabled_at = null, last_used_step = null,
                  failed_attempts = 0, locked_until = null, updated_at = now()
                """, user.getId(), encrypt(secret));
        String account = user.getEmail() == null ? user.getUsername() : user.getEmail();
        return AuthResponse.mfaChallenge(jwtService.generateMfaToken(user.getId(), user.getUsername(), PURPOSE_ENROLL, CHALLENGE_MILLIS),
                true, secret, Totp.otpauthUri(ISSUER, account, secret));
    }

    /**
     * Comprueba el código del desafío y devuelve el usuario si es válido. En el alta, el primer código
     * correcto confirma el secreto. Cada fallo cuenta para el bloqueo.
     */
    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public UUID verify(String mfaToken, String code, String expectedPurpose) {
        JwtService.MfaIdentity identity;
        try {
            identity = jwtService.extractMfaIdentity(mfaToken);
        } catch (RuntimeException invalid) {
            throw new InvalidCredentialsException();
        }
        if (!expectedPurpose.equals(identity.purpose())) throw new InvalidCredentialsException();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select secret_enc, enabled_at, last_used_step, failed_attempts, locked_until from platform_user_mfa where user_id = ? for update",
                identity.userId());
        if (rows.isEmpty()) throw new InvalidCredentialsException();
        Map<String, Object> mfa = rows.get(0);
        assertNotLocked(mfa);
        boolean enrolled = mfa.get("enabled_at") != null;
        if (enrolled != PURPOSE_VERIFY.equals(expectedPurpose)) throw new InvalidCredentialsException();
        Long lastStep = mfa.get("last_used_step") == null ? null : ((Number) mfa.get("last_used_step")).longValue();
        long step = Totp.matchingStep(decrypt((String) mfa.get("secret_enc")), code, Instant.now().getEpochSecond(), lastStep);
        if (step < 0) {
            int failures = ((Number) mfa.get("failed_attempts")).intValue() + 1;
            jdbc.update("update platform_user_mfa set failed_attempts = ?, locked_until = ?, updated_at = now() where user_id = ?",
                    failures >= MAX_FAILURES ? 0 : failures,
                    failures >= MAX_FAILURES ? Timestamp.from(Instant.now().plus(LOCK_MINUTES, ChronoUnit.MINUTES)) : null,
                    identity.userId());
            throw new InvalidCredentialsException();
        }
        jdbc.update("""
                update platform_user_mfa set last_used_step = ?, failed_attempts = 0, locked_until = null,
                  enabled_at = coalesce(enabled_at, now()), updated_at = now() where user_id = ?
                """, step, identity.userId());
        return identity.userId();
    }

    /** El superadministrador borra el doble factor de una cuenta (teléfono perdido): se vuelve a registrar al entrar. */
    @Transactional
    public void reset(UUID userId) {
        jdbc.update("delete from platform_user_mfa where user_id = ?", userId);
    }

    public boolean enabled(UUID userId) {
        Map<String, Object> mfa = row(userId);
        return mfa != null && mfa.get("enabled_at") != null;
    }

    private Map<String, Object> row(UUID userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select enabled_at, failed_attempts, locked_until from platform_user_mfa where user_id = ?", userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static void assertNotLocked(Map<String, Object> mfa) {
        Instant locked = PlatformTenantService.instant(mfa.get("locked_until"));
        if (locked != null && locked.isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Demasiados códigos incorrectos. Espera unos minutos antes de volver a intentar.");
        }
    }

    // ------------------------------------------------------------ cifrado

    String encrypt(String secret) {
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.US_ASCII));
            return "v1:" + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("No se pudo cifrar el secreto del doble factor", exception);
        }
    }

    String decrypt(String stored) {
        try {
            if (stored == null || !stored.startsWith("v1:")) throw new IllegalStateException("Formato de secreto desconocido");
            byte[] data = Base64.getDecoder().decode(stored.substring(3));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, data, 0, 12));
            return new String(cipher.doFinal(data, 12, data.length - 12), StandardCharsets.US_ASCII);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("No se pudo descifrar el secreto del doble factor", exception);
        }
    }

    private static byte[] keyBytes(String configured, String jwtSecret) {
        if (configured != null && !configured.isBlank()) {
            byte[] decoded = Base64.getDecoder().decode(configured.trim());
            if (decoded.length != 32) throw new IllegalStateException("app.mfa.encryption-key debe ser Base64 de 32 bytes");
            return decoded;
        }
        try {
            return MessageDigest.getInstance("SHA-256").digest(("nexodocs-mfa-v1:" + jwtSecret).getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("SHA-256 no disponible", exception);
        }
    }
}
