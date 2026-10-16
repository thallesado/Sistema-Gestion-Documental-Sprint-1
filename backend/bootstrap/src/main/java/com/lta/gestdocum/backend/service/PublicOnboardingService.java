package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.PublicOnboardingRequest;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.model.Role;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.PermissionRepository;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class PublicOnboardingService {
    private final TenantRepository tenants; private final PlanRepository plans; private final UserRepository users;
    private final RoleRepository roles; private final PermissionRepository permissions; private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    public PublicOnboardingService(TenantRepository tenants, PlanRepository plans, UserRepository users,
                                   RoleRepository roles, PermissionRepository permissions, PasswordEncoder passwordEncoder,
                                   AuthService authService) {
        this.tenants = tenants; this.plans = plans; this.users = users; this.roles = roles;
        this.permissions = permissions; this.passwordEncoder = passwordEncoder; this.authService = authService;
    }

    @Transactional
    public AuthResponse onboard(PublicOnboardingRequest request) {
        String planCode = request.planCode().trim().toUpperCase(Locale.ROOT);
        Plan plan = plans.findFirstByCodeIgnoreCaseAndActiveTrue(planCode)
                .orElseThrow(() -> new IllegalArgumentException("El plan seleccionado no está disponible"));
        String stem = slugify(request.tenantName());
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID()); tenant.setName(request.tenantName().trim());
        tenant.setSlug(stem + "-" + suffix); tenant.setCode(("ORG-" + suffix).toUpperCase(Locale.ROOT));
        Instant trialStart = Instant.now();
        tenant.setEmail(request.email().trim().toLowerCase(Locale.ROOT)); tenant.setStatus(Tenant.Status.TRIAL); tenant.setPlanId(plan.getId());
        tenant.setTrialStartAt(trialStart); tenant.setTrialEndsAt(trialStart.plus(12, ChronoUnit.DAYS));
        tenant.setBillingCycle("MONTHLY");
        tenants.save(tenant);

        String[] names = request.administratorName().trim().split("\\s+", 2);
        String username = uniqueUsername(request.email(), suffix);
        User administrator = users.save(User.builder().tenantId(tenant.getId()).username(username)
                .email(request.email().trim().toLowerCase(Locale.ROOT)).passwordHash(passwordEncoder.encode(request.password()))
                .firstName(names[0]).lastName(names.length > 1 ? names[1] : "Administrador")
                .status(UserStatus.ACTIVE).build());
        Role administratorRole = roles.save(Role.builder().tenantId(tenant.getId()).name("Administrador de tenant")
                .description("Administrador inicial creado durante el onboarding").isSystem(true).isActive(true).build());
        roles.assign(tenant.getId(), administrator.getId(), administratorRole.getId());
        permissions.findByIsActiveTrueOrderByModuleAscActionAsc()
                .forEach(permission -> roles.grantPermission(tenant.getId(), administratorRole.getId(), permission.getId()));

        AuthRequest login = new AuthRequest(); login.setTenantId(tenant.getId()); login.setUsernameOrEmail(request.email()); login.setPassword(request.password());
        return authService.login(login);
    }

    private String uniqueUsername(String email, String suffix) {
        String local = email.substring(0, email.indexOf('@')).replaceAll("[^A-Za-z0-9_.-]", "");
        return (local.isBlank() ? "admin" : local).substring(0, Math.min(60, Math.max(1, local.length()))) + "-" + suffix;
    }

    private String slugify(String value) {
        String result = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return result.isBlank() ? "organizacion" : result.substring(0, Math.min(45, result.length()));
    }
}
