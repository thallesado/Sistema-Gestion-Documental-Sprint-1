package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ForgotPasswordRequest;
import com.lta.gestdocum.backend.dto.ResetPasswordRequest;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.PasswordRecoveryRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.PasswordRecoveryRequestRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public PasswordRecoveryService(
            UserRepository userRepository,
            PasswordRecoveryRequestRepository requestRepository,
            PasswordEncoder passwordEncoder,
            JavaMailSender mailSender,
            JwtService jwtService,
            AuthSessionService authSessionService,
            @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl,
            @Value("${app.mail-from:hello@demomailtrap.co}") String mailFrom,
            @Value("${app.password-recovery-expiration-minutes:30}") long tokenExpirationMinutes) {
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
        this.jwtService = jwtService;
        this.authSessionService = authSessionService;
        this.frontendUrl = frontendUrl;
        this.mailFrom = mailFrom;
        this.tokenExpirationMinutes = tokenExpirationMinutes;
    }

    @Transactional
    public String requestRecovery(ForgotPasswordRequest request) {
        userRepository.findByTenantAndIdentifier(request.tenantId(), request.email())
                .filter(user -> user.getDeletedAt() == null && user.getStatus() == User.UserStatus.ACTIVE)
                .ifPresent(user -> createAndSend(user));
        return GENERIC_RESPONSE;
    }

    @Transactional
    public AuthResponse resetPassword(ResetPasswordRequest request) {
        String rawToken = normalizeToken(request.token());
        PasswordRecoveryRequest recovery = requestRepository.findByTokenHashAndUsedAtIsNull(hash(rawToken))
                .filter(item -> item.getExpiresAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC)))
                .orElseThrow(InvalidCredentialsException::new);

        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(recovery.getUserId(), recovery.getTenantId())
                .filter(candidate -> candidate.getStatus() == User.UserStatus.ACTIVE)
                .orElseThrow(InvalidCredentialsException::new);

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        recovery.setUsedAt(OffsetDateTime.now(ZoneOffset.UTC));
        userRepository.save(user);
        requestRepository.save(recovery);

        authSessionService.revokeAll(user.getId());

        var authorities = userRepository.findAuthorityCodes(user.getId(), user.getTenantId());
        if (authorities.isEmpty()) {
            throw new InvalidCredentialsException();
        }
        String accessToken = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), authorities);
        String refreshToken = jwtService.generateRefreshToken(
                user.getId(), user.getTenantId(), user.getUsername());
        authSessionService.issue(user, refreshToken, jwtService.getRefreshExpiration());
        return new AuthResponse(accessToken, "Bearer", refreshToken, jwtService.getExpiration());
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
                + frontendUrl + "/reset-password/" + rawToken
                + "\n\nSi no fuiste tú, ignora este correo.");
        mailSender.send(message);
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
