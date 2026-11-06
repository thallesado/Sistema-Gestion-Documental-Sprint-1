package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ForgotPasswordRequest;
import com.lta.gestdocum.backend.dto.ResetPasswordRequest;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.PasswordRecoveryRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.PasswordRecoveryRequestRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.net.URLDecoder;

@Service
public class PasswordRecoveryService {
    private static final String GENERIC_RESPONSE =
            "Si los datos corresponden a una cuenta, recibirás instrucciones por correo.";

    private final UserRepository userRepository;
    private final PasswordRecoveryRequestRepository requestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final JwtService jwtService;
    private final AuthSessionService authSessionService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String frontendUrl;
    private final String mailFrom;
    private final long tokenExpirationMinutes;
    private volatile JdbcTemplate tenantJdbc;
    private volatile TransactionTemplate transactions;

    public PasswordRecoveryService(
            UserRepository userRepository,
            PasswordRecoveryRequestRepository requestRepository,
            PasswordEncoder passwordEncoder,
            JavaMailSender mailSender,
            JwtService jwtService,
            AuthSessionService authSessionService,
            @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl,
            @Value("${app.mail-from:hello@demomailtrap.co}") String mailFrom,
            @Value("${app.password-recovery-expiration-minutes:30}") long tokenExpirationMinutes,
            PlatformTransactionManager transactionManager) {
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
        this.jwtService = jwtService;
        this.authSessionService = authSessionService;
        this.frontendUrl = frontendUrl;
        this.mailFrom = mailFrom;
        this.tokenExpirationMinutes = tokenExpirationMinutes;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setTenantJdbc(JdbcTemplate jdbc) { this.tenantJdbc = jdbc; }

    public String requestRecovery(ForgotPasswordRequest request) {
        return inTenant(request.tenantId(), () -> {
            JdbcTemplate jdbc = requireJdbc();
            List<User> matches = jdbc.query("SELECT * FROM app.lookup_tenant_login(?::uuid, ?::text)",
                    (row, index) -> User.builder().id(row.getObject("id", UUID.class))
                            .tenantId(row.getObject("tenant_id", UUID.class)).username(row.getString("username"))
                            .email(row.getString("email")).passwordHash(row.getString("password_hash"))
                            .firstName(row.getString("first_name")).lastName(row.getString("last_name"))
                            .status(UserStatus.valueOf(row.getString("status")))
                            .deletedAt(row.getObject("deleted_at", OffsetDateTime.class))
                            .isPlatformAdmin(row.getBoolean("is_platform_admin")).build(),
                    request.tenantId(), request.email());
            jdbc.execute("SET LOCAL ROLE nexodocs_app");
            matches.stream().filter(user -> user.getDeletedAt() == null && user.getStatus() == UserStatus.ACTIVE)
                    .findFirst().ifPresent(this::createAndSend);
            return GENERIC_RESPONSE;
        });
    }

    public AuthResponse resetPassword(ResetPasswordRequest request) {
        UUID tenantId = request.tenantId();
        return inTenant(tenantId, () -> {
            JdbcTemplate jdbc = requireJdbc();
            String rawToken = normalizeToken(request.token());
            List<PasswordRecoveryRequest> found = jdbc.query(
                    "SELECT * FROM app.lookup_password_recovery(?::text)",
                    (row, index) -> PasswordRecoveryRequest.builder().id(row.getObject("id", UUID.class))
                            .userId(row.getObject("user_id", UUID.class)).tenantId(row.getObject("tenant_id", UUID.class))
                            .tokenHash(row.getString("token_hash")).expiresAt(row.getObject("expires_at", OffsetDateTime.class))
                            .usedAt(row.getObject("used_at", OffsetDateTime.class))
                            .createdAt(row.getObject("created_at", OffsetDateTime.class)).build(), hash(rawToken));
            PasswordRecoveryRequest recovery = found.stream().findFirst()
                    .filter(item -> tenantId == null || tenantId.equals(item.getTenantId()))
                    .orElseThrow(InvalidCredentialsException::new);
            jdbc.execute("SET LOCAL ROLE nexodocs_app");
            return completeReset(request, recovery);
        });
    }

    private AuthResponse completeReset(ResetPasswordRequest request, PasswordRecoveryRequest recovery) {
        recovery = requestRepository.findByTokenHashAndUsedAtIsNull(recovery.getTokenHash())
                .orElseThrow(InvalidCredentialsException::new);
        if (!recovery.getExpiresAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC))) throw new InvalidCredentialsException();
        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(recovery.getUserId(), recovery.getTenantId())
                .filter(candidate -> candidate.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(InvalidCredentialsException::new);
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        recovery.setUsedAt(OffsetDateTime.now(ZoneOffset.UTC));
        userRepository.save(user);
        requestRepository.save(recovery);
        authSessionService.revokeAll(user.getId());
        var authorities = user.isPlatformAdmin()
                ? com.lta.gestdocum.backend.security.PlatformAuthorities.CODES
                : userRepository.findAuthorityCodes(user.getId(), user.getTenantId());
        if (authorities.isEmpty()) throw new InvalidCredentialsException();
        String accessToken = jwtService.generateToken(user.getId(), user.getTenantId(), user.getUsername(), authorities);
        String refreshToken = jwtService.generateRefreshToken(user.getId(), user.getTenantId(), user.getUsername());
        authSessionService.issue(user, refreshToken, jwtService.getRefreshExpiration());
        return new AuthResponse(accessToken, "Bearer", refreshToken, jwtService.getExpiration(), authorities);
    }

    private <T> T inTenant(UUID tenantId, Supplier<T> work) {
        TenantDatabaseContext.Scope scope = tenantId == null
                ? TenantDatabaseContext.useControl() : TenantDatabaseContext.useTenant(tenantId);
        try (scope) {
            TransactionTemplate tx = transactions;
            if (tx == null) throw new IllegalStateException("No está disponible la transacción de recuperación.");
            return tx.execute(status -> work.get());
        }
    }

    private JdbcTemplate requireJdbc() {
        JdbcTemplate jdbc = tenantJdbc;
        if (jdbc == null) throw new IllegalStateException("No está disponible la base de datos de recuperación.");
        return jdbc;
    }

    private void createAndSend(User user) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        PasswordRecoveryRequest recovery = PasswordRecoveryRequest.builder()
                .userId(user.getId())
                .tenantId(user.getTenantId())
                .tokenHash(hash(rawToken))
                .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                .expiresAt(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(tokenExpirationMinutes))
                .build();
        requestRepository.save(recovery);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(user.getEmail());
        message.setSubject("Recuperación de contraseña - NexoDocs");
        message.setText("Solicitaste recuperar tu contraseña. Usa este enlace dentro de "
                + tokenExpirationMinutes + " minutos:\n\n"
                + frontendUrl + "/reset-password/" + rawToken + "?tenantId=" + user.getTenantId()
                + "\n\nSi no fuiste tú, ignora este correo.");
        try {
            mailSender.send(message);
        } catch (org.springframework.mail.MailException mailException) {
            org.slf4j.LoggerFactory.getLogger(PasswordRecoveryService.class)
                    .warn("No se pudo enviar el correo de recuperación SMTP: {}. Token generado en base de datos.", mailException.getMessage());
        }
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no está disponible", exception);
        }
    }

    private String normalizeToken(String token) {
        String normalized = URLDecoder.decode(token, StandardCharsets.UTF_8).trim();
        return normalized.replaceAll("\\s+", "");
    }
}
