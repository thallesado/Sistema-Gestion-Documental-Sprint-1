package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.PlanEnforcementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/** Enforces subscription state before every authenticated tenant mutation. */
@Component
public class TenantTrialEnforcementInterceptor implements HandlerInterceptor {
    private static final Set<String> MUTATING_METHODS = Set.of(
            HttpMethod.POST.name(), HttpMethod.PUT.name(), HttpMethod.PATCH.name(), HttpMethod.DELETE.name());
    private final PlanEnforcementService plans;

    public TenantTrialEnforcementInterceptor(PlanEnforcementService plans) {
        this.plans = plans;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!MUTATING_METHODS.contains(request.getMethod()) || isActivationPath(request.getRequestURI())) return true;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)
                || user.tenantId() == null) return true;
        // The service is transactional and emits PlanLimitExceededException, which
        // the global handler maps to 403 + PLAN_LIMIT_EXCEEDED.
        plans.validateWriteAccess(user.tenantId());
        return true;
    }

    private boolean isActivationPath(String path) {
        return "/api/v1/billing/checkout/initiate".equals(path)
                || "/api/v1/billing/checkout/confirm".equals(path)
                || "/api/v1/billing/webhooks/stripe".equals(path)
                // Con un cobro fallido (PAST_DUE) el portal es donde se actualiza la tarjeta.
                || "/api/v1/billing/portal".equals(path)
                || path.startsWith("/api/v1/auth/")
                || "/api/v1/public/onboarding".equals(path);
    }
}
