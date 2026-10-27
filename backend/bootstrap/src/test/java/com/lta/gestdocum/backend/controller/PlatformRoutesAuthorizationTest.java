package com.lta.gestdocum.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Un administrador de tenant nunca tiene platform:tenant:manage (PlatformAuthorities solo lo da a cuentas
 * sin tenant), así que recibe 403 en /platform/*. Además los servicios rechazan una cuenta con tenant.
 */
class PlatformRoutesAuthorizationTest {
    private static final List<Class<?>> PLATFORM_CONTROLLERS = List.of(
            PlatformAnalyticsController.class, PlatformBackupController.class, PlatformTenantController.class,
            PlatformPlanController.class, PlatformAddonController.class);

    @Test
    void everyPlatformControllerRequiresThePlatformAuthority() {
        for (Class<?> controller : PLATFORM_CONTROLLERS) {
            RequestMapping mapping = controller.getAnnotation(RequestMapping.class);
            assertNotNull(mapping, controller.getSimpleName());
            assertTrue(mapping.value()[0].startsWith("/api/v1/platform"), controller.getSimpleName());
            PreAuthorize guard = controller.getAnnotation(PreAuthorize.class);
            assertNotNull(guard, controller.getSimpleName() + " must be guarded at class level");
            assertEquals("hasAuthority('platform:tenant:manage')", guard.value());
        }
    }
}
