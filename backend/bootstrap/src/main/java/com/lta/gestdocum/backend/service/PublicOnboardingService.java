package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.PublicOnboardingRequest;
import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.PlanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

/**
 * Onboarding público: valida el plan y delega la creación de la organización, su administrador, rol,
 * permisos y catálogos en {@link TenantService#create(TenantCreateRequest, String)}, el mismo recorrido
 * que usan el alta de superadmin y /public/signup.
 */
@Service
public class PublicOnboardingService {
    private final PlanRepository plans;
    private final AuthService authService;
    private final TenantService tenantService;

    public PublicOnboardingService(PlanRepository plans, AuthService authService, TenantService tenantService) {
        this.plans = plans;
        this.authService = authService;
        this.tenantService = tenantService;
    }

    @Transactional
    public AuthResponse onboard(PublicOnboardingRequest request) {
        String planCode = request.planCode().trim().toUpperCase(Locale.ROOT);
        Plan plan = plans.findFirstByCodeIgnoreCaseAndActiveTrue(planCode)
                .orElseThrow(() -> new IllegalArgumentException("El plan seleccionado no está disponible"));
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        TenantResponse tenant = tenantService.create(new TenantCreateRequest(
                request.tenantName().trim(),
                ("ORG-" + suffix).toUpperCase(Locale.ROOT),
                slugify(request.tenantName()) + "-" + suffix,
                email,
                plan.getId(),
                email,
                request.administratorName().trim()), request.password());

        AuthRequest login = new AuthRequest();
        login.setTenantId(tenant.id());
        login.setUsernameOrEmail(request.email());
        login.setPassword(request.password());
        return authService.login(login);
    }

    private String slugify(String value) {
        String result = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return result.isBlank() ? "organizacion" : result.substring(0, Math.min(45, result.length()));
    }
}
