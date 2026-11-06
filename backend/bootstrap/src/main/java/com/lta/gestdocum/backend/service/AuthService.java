package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.RefreshTokenRequest;
import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;


@Service
public class AuthService {

    private volatile TenantDatabaseLifecycleService tenantDatabaseLifecycleService;

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PlanRepository planRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthSessionService authSessionService;
    private final AccessTokenRevocationService accessTokenRevocationService;
    private volatile JdbcTemplate tenantLoginJdbc;
    private volatile TransactionTemplate tenantLoginTransaction;
    private UserCustomizationService userCustomizationService;
    private SubscriptionLifecycleService subscriptionLifecycleService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setSubscriptionLifecycleService(SubscriptionLifecycleService subscriptionLifecycleService) {
        this.subscriptionLifecycleService = subscriptionLifecycleService;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setUserCustomizationService(UserCustomizationService userCustomizationService) {
        this.userCustomizationService = userCustomizationService;
    }

    public AuthService(UserRepository userRepository,
                       TenantRepository tenantRepository,
                       PlanRepository planRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuthSessionService authSessionService,
                       AccessTokenRevocationService accessTokenRevocationService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.planRepository = planRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authSessionService = authSessionService;
        this.accessTokenRevocationService = accessTokenRevocationService;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setTenantDatabaseLifecycleService(TenantDatabaseLifecycleService service) {
        this.tenantDatabaseLifecycleService = service;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setTenantLoginInfrastructure(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.tenantLoginJdbc = jdbc;
        this.tenantLoginTransaction = new TransactionTemplate(transactionManager);
    }

    /** Resuelve la organización por alias (slug), código o nombre, sin distinguir mayúsculas. */
    private UUID resolveTenantId(String tenantName) {
        if (tenantName == null || tenantName.isBlank()) return null;
        String value = tenantName.trim();
        return tenantRepository.findFirstBySlugIgnoreCase(value)
                .or(() -> tenantRepository.findFirstByCodeIgnoreCase(value))
                .or(() -> tenantRepository.findFirstByNameIgnoreCase(value))
                .map(Tenant::getId)
                .orElseThrow(() -> new NotFoundException("Organización no encontrada"));
    }

    public AuthResponse login(AuthRequest request) {
        UUID tenantId = request.getTenantId() != null ? request.getTenantId() : resolveTenantId(request.getTenantName());
        ensureTenantLoginAllowed(tenantId);
        TenantDatabaseLifecycleService lifecycle = tenantDatabaseLifecycleService;
        if (tenantId != null && lifecycle != null && lifecycle.isIsolatedTenant(tenantId)) {
            JdbcTemplate jdbc = tenantLoginJdbc;
            TransactionTemplate tx = tenantLoginTransaction;
            if (jdbc == null || tx == null) throw new IllegalStateException("No está disponible el inicio de sesión aislado.");
            try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useTenant(tenantId)) {
                return tx.execute(status -> loginIsolatedTenant(request, tenantId, jdbc));
            }
        }
        try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useTenant(tenantId)) {
            User user;
        if (tenantId == null) {
            user = userRepository.findByPlatformIdentifier(request.getUsernameOrEmail())
                    .orElseThrow(InvalidCredentialsException::new);
        } else {
            user = userRepository.findByTenantAndIdentifier(tenantId, request.getUsernameOrEmail())
                    .orElseThrow(InvalidCredentialsException::new);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        if (user.getDeletedAt() != null || user.getStatus() != UserStatus.ACTIVE) {
            throw new InvalidCredentialsException();
        }
        // Organización cancelada (período de gracia) o eliminada; 403 con el motivo.
        if (subscriptionLifecycleService != null) subscriptionLifecycleService.assertTenantAccess(user);
        // Vigencia y horario de acceso personalizados (user:customize); 403 con el motivo.
        if (userCustomizationService != null) userCustomizationService.assertAccessAllowed(user);

        List<String> authorities = resolveAuthorities(user);
        if (authorities.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "El usuario no tiene permisos activos asignados");
        }
        String token = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), tokenAuthorities(user, authorities));
        String refreshToken = jwtService.generateRefreshToken(user.getId(), user.getTenantId(), user.getUsername());
        authSessionService.issue(user, refreshToken, jwtService.getRefreshExpiration());
        return new AuthResponse(token, "Bearer", refreshToken, jwtService.getExpiration(), authorities,
                user.isMustChangePassword());
        }
    }

    private AuthResponse loginIsolatedTenant(AuthRequest request, UUID tenantId, JdbcTemplate jdbc) {
        User user = lookupIsolatedUser(tenantId, request.getUsernameOrEmail(), jdbc);
        jdbc.execute("SET LOCAL ROLE nexodocs_app");
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())
                || user.getDeletedAt() != null || user.getStatus() != UserStatus.ACTIVE) {
            throw new InvalidCredentialsException();
        }
        if (subscriptionLifecycleService != null) subscriptionLifecycleService.assertTenantAccess(user);
        if (userCustomizationService != null) userCustomizationService.assertAccessAllowed(user);
        List<String> authorities = resolveAuthorities(user);
        if (authorities.isEmpty()) throw new org.springframework.security.access.AccessDeniedException(
                "El usuario no tiene permisos activos asignados");
        String token = jwtService.generateToken(user.getId(), tenantId, user.getUsername(), tokenAuthorities(user, authorities));
        String refreshToken = jwtService.generateRefreshToken(user.getId(), tenantId, user.getUsername());
        authSessionService.issue(user, refreshToken, jwtService.getRefreshExpiration());
        return new AuthResponse(token, "Bearer", refreshToken, jwtService.getExpiration(), authorities,
                user.isMustChangePassword());
    }

    private void ensureTenantLoginAllowed(UUID tenantId) {
        TenantDatabaseLifecycleService lifecycle = tenantDatabaseLifecycleService;
        if (tenantId != null && lifecycle != null && !lifecycle.isTenantLoginAllowed(tenantId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "La organización no está habilitada para iniciar sesión.");
        }
    }

    public AuthResponse refresh(RefreshTokenRequest request) {
        AuthenticatedRefresh refresh = parseRefresh(request.getRefreshToken());
        ensureTenantLoginAllowed(refresh.tenantId());
        TenantDatabaseLifecycleService lifecycle = tenantDatabaseLifecycleService;
        if (refresh.tenantId() != null && lifecycle != null && lifecycle.isIsolatedTenant(refresh.tenantId())) {
            JdbcTemplate jdbc = tenantLoginJdbc;
            TransactionTemplate tx = tenantLoginTransaction;
            if (jdbc == null || tx == null) throw new IllegalStateException("No está disponible la renovación de sesión aislada.");
            try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useTenant(refresh.tenantId())) {
                return tx.execute(status -> refreshIsolated(refresh, request.getRefreshToken(), jdbc));
            }
        }
        try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useTenant(refresh.tenantId())) {
        User user = (refresh.tenantId() == null
                ? userRepository.findByPlatformIdentifier(refresh.username())
                : userRepository.findByTenantAndIdentifier(refresh.tenantId(), refresh.username()))
                .orElseThrow(InvalidCredentialsException::new);
        if (!user.getId().equals(refresh.userId())
                || user.getDeletedAt() != null
                || user.getStatus() != UserStatus.ACTIVE) {
            throw new InvalidCredentialsException();
        }
        if (subscriptionLifecycleService != null) subscriptionLifecycleService.assertTenantAccess(user);
        if (userCustomizationService != null) userCustomizationService.assertAccessAllowed(user);
        List<String> authorities = resolveAuthorities(user);
        if (authorities.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "El usuario no tiene permisos activos asignados");
        }
        String token = jwtService.generateToken(
                user.getId(), user.getTenantId(), user.getUsername(), tokenAuthorities(user, authorities));
        String replacementRefreshToken = jwtService.generateRefreshToken(
                user.getId(), user.getTenantId(), user.getUsername());
        authSessionService.rotate(user, request.getRefreshToken(), replacementRefreshToken,
                jwtService.getRefreshExpiration());
        return new AuthResponse(token, "Bearer", replacementRefreshToken, jwtService.getExpiration(), authorities,
                user.isMustChangePassword());
        }
    }

    private AuthResponse refreshIsolated(AuthenticatedRefresh refresh, String currentRefreshToken, JdbcTemplate jdbc) {
        User user = lookupIsolatedUser(refresh.tenantId(), refresh.username(), jdbc);
        jdbc.execute("SET LOCAL ROLE nexodocs_app");
        if (!user.getId().equals(refresh.userId()) || user.getDeletedAt() != null
                || user.getStatus() != UserStatus.ACTIVE) throw new InvalidCredentialsException();
        if (subscriptionLifecycleService != null) subscriptionLifecycleService.assertTenantAccess(user);
        if (userCustomizationService != null) userCustomizationService.assertAccessAllowed(user);
        List<String> authorities = resolveAuthorities(user);
        if (authorities.isEmpty()) throw new org.springframework.security.access.AccessDeniedException(
                "El usuario no tiene permisos activos asignados");
        String accessToken = jwtService.generateToken(user.getId(), refresh.tenantId(), user.getUsername(),
                tokenAuthorities(user, authorities));
        String replacement = jwtService.generateRefreshToken(user.getId(), refresh.tenantId(), user.getUsername());
        authSessionService.rotate(user, currentRefreshToken, replacement, jwtService.getRefreshExpiration());
        return new AuthResponse(accessToken, "Bearer", replacement, jwtService.getExpiration(), authorities,
                user.isMustChangePassword());
    }

    private User lookupIsolatedUser(UUID tenantId, String identifier, JdbcTemplate jdbc) {
        List<User> matches = jdbc.query("SELECT * FROM app.lookup_tenant_login(?::uuid, ?::text)",
                (row, index) -> User.builder()
                        .id(row.getObject("id", UUID.class)).tenantId(row.getObject("tenant_id", UUID.class))
                        .username(row.getString("username")).email(row.getString("email"))
                        .passwordHash(row.getString("password_hash")).firstName(row.getString("first_name"))
                        .lastName(row.getString("last_name")).status(UserStatus.valueOf(row.getString("status")))
                        .deletedAt(row.getObject("deleted_at", java.time.OffsetDateTime.class))
                        .isPlatformAdmin(row.getBoolean("is_platform_admin"))
                        .preferredLanguage(row.getString("preferred_language"))
                        .mustChangePassword(row.getBoolean("must_change_password")).build(), tenantId, identifier);
        return matches.stream().findFirst().orElseThrow(InvalidCredentialsException::new);
    }

    /** Con contraseña temporal el JWT lleva además la marca que usa MustChangePasswordFilter. */
    private List<String> tokenAuthorities(User user, List<String> authorities) {
        if (!user.isMustChangePassword()) return authorities;
        List<String> marked = new java.util.ArrayList<>(authorities);
        marked.add(com.lta.gestdocum.backend.security.MustChangePasswordFilter.MARKER_AUTHORITY);
        return marked;
    }

    private List<String> resolveAuthorities(User user) {
        if (user.isPlatformAdmin()) {
            return com.lta.gestdocum.backend.security.PlatformAuthorities.CODES;
        }
        if (user.getTenantId() == null) {
            return java.util.List.of();
        }
        List<String> rawCodes = userRepository.findAuthorityCodes(user.getId(), user.getTenantId());
        List<String> enabledFeatures = planRepository.findEnabledFeatureKeysByTenantId(user.getTenantId());
        java.util.Set<String> featureSet = new java.util.HashSet<>(enabledFeatures);
        return rawCodes.stream()
                .filter(code -> PlanFeatureMatrix.isPermissionAllowed(null, code, featureSet))
                .toList();
    }


    public void logout(AuthenticatedUser authenticatedUser, String token, String refreshToken) {
        accessTokenRevocationService.revoke(authenticatedUser, token);
        authSessionService.revoke(authenticatedUser, refreshToken);
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
