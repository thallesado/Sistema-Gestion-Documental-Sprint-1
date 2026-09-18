package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.RefreshTokenRequest;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Set;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthSessionService authSessionService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuthSessionService authSessionService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authSessionService = authSessionService;
    }

    public AuthResponse login(AuthRequest request) {
        User user;
        if (request.getTenantId() == null) {
            user = userRepository.findByPlatformIdentifier(request.getUsernameOrEmail())
                    .orElseThrow(InvalidCredentialsException::new);
        } else {
            user = userRepository.findByTenantAndIdentifier(request.getTenantId(), request.getUsernameOrEmail())
                    .orElseThrow(InvalidCredentialsException::new);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        if (user.getDeletedAt() != null || user.getStatus() != User.UserStatus.ACTIVE) {
            throw new InvalidCredentialsException();
        }

        List<String> authorities = user.isPlatformAdmin()
                ? List.of("tenant:manage", "audit:read_global")
                : userRepository.findAuthorityCodes(user.getId(), user.getTenantId());
        if (authorities.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "El usuario no tiene permisos activos asignados");
        }
        String token = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), authorities);
        String refreshToken = jwtService.generateRefreshToken(
                user.getId(), user.getTenantId(), user.getUsername());
        authSessionService.issue(user, refreshToken, jwtService.getRefreshExpiration());
        return new AuthResponse(token, "Bearer", refreshToken, jwtService.getExpiration());
    }

    public AuthResponse refresh(RefreshTokenRequest request) {
        AuthenticatedRefresh refresh = parseRefresh(request.getRefreshToken());
        User user = (refresh.tenantId() == null
                ? userRepository.findByPlatformIdentifier(refresh.username())
                : userRepository.findByTenantAndIdentifier(refresh.tenantId(), refresh.username()))
                .orElseThrow(InvalidCredentialsException::new);
        if (!user.getId().equals(refresh.userId())
                || user.getDeletedAt() != null
                || user.getStatus() != User.UserStatus.ACTIVE) {
            throw new InvalidCredentialsException();
        }
        List<String> authorities = user.isPlatformAdmin()
                ? List.of("tenant:manage", "audit:read_global")
                : userRepository.findAuthorityCodes(user.getId(), user.getTenantId());
        if (authorities.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "El usuario no tiene permisos activos asignados");
        }
        String token = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), authorities);
        String replacementRefreshToken = jwtService.generateRefreshToken(
                user.getId(), user.getTenantId(), user.getUsername());
        authSessionService.rotate(user, request.getRefreshToken(), replacementRefreshToken,
                jwtService.getRefreshExpiration());
        return new AuthResponse(token, "Bearer", replacementRefreshToken, jwtService.getExpiration());
    }

    public void logout(String token, String refreshToken) {
        jwtService.revoke(token);
        authSessionService.revoke(refreshToken);
    }

    private AuthenticatedRefresh parseRefresh(String token) {
        try {
            var refreshUser = jwtService.extractRefreshIdentity(token);
            return new AuthenticatedRefresh(refreshUser.userId(), refreshUser.tenantId(), refreshUser.username());
        } catch (RuntimeException exception) {
            throw new InvalidCredentialsException();
        }
    }

    private record AuthenticatedRefresh(java.util.UUID userId, java.util.UUID tenantId, String username) {
    }
}
