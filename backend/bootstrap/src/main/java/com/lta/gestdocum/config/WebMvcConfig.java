package com.lta.gestdocum.config;

import com.lta.gestdocum.auditoria.infrastructure.interceptor.HttpAuditInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    private final HttpAuditInterceptor httpAuditInterceptor;
    private final TenantTrialEnforcementInterceptor tenantTrialEnforcementInterceptor;

    public WebMvcConfig(HttpAuditInterceptor httpAuditInterceptor,
                         TenantTrialEnforcementInterceptor tenantTrialEnforcementInterceptor) {
        this.httpAuditInterceptor = httpAuditInterceptor;
        this.tenantTrialEnforcementInterceptor = tenantTrialEnforcementInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantTrialEnforcementInterceptor)
                .addPathPatterns("/api/**");
        registry.addInterceptor(httpAuditInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/v1/auth/**");
    }
}
