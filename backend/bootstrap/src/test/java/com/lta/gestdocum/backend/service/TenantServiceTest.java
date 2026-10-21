package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.dto.TenantSettingsResponse;
import com.lta.gestdocum.backend.dto.TenantSettingsUpdateRequest;
import com.lta.gestdocum.backend.model.*;
import com.lta.gestdocum.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class TenantServiceTest {

    @Mock private TenantRepository tenantRepository;
    @Mock private PlanRepository planRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JavaMailSender mailSender;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;

    private TenantService tenantService;

    @BeforeEach
    void setUp() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-temp-password");
        tenantService = new TenantService(
                tenantRepository,
                planRepository,
                userRepository,
                roleRepository,
                permissionRepository,
                passwordEncoder,
                mailSenderProvider
        );
    }

    @Test
    void createTenant_WithAdminAndPlan_CreatesCompleteTenantWithAdminRoleAndMail() {
        UUID planId = UUID.randomUUID();
        TenantCreateRequest request = new TenantCreateRequest(
                "Hospital Central",
                "HOSP-01",
                "hospital-central",
                "contacto@hospital.test",
                planId,
                "admin@hospital.test",
                "Carlos Admin"
        );

        when(tenantRepository.save(any(Tenant.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> {
            Role r = invocation.getArgument(0);
            r.setId(10L);
            return r;
        });
        when(permissionRepository.findByIsActiveTrueOrderByModuleAscActionAsc()).thenReturn(Collections.emptyList());

        TenantResponse response = tenantService.create(request);

        assertNotNull(response);
        assertEquals("Hospital Central", response.name());
        assertEquals("HOSP-01", response.code());
        assertEquals(planId, response.planId());

        // Verificar guardado del tenant
        ArgumentCaptor<Tenant> tenantCaptor = ArgumentCaptor.forClass(Tenant.class);
        verify(tenantRepository).save(tenantCaptor.capture());
        Tenant savedTenant = tenantCaptor.getValue();
        assertEquals(Tenant.Status.TRIAL, savedTenant.getStatus());
        assertEquals("USD", savedTenant.getCurrency());
        assertNotNull(savedTenant.getTrialStartAt());
        assertNotNull(savedTenant.getTrialEndsAt());

        // Verificar creación del administrador con contraseña temporal y mustChangePassword = true
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedAdmin = userCaptor.getValue();
        assertEquals("admin@hospital.test", savedAdmin.getEmail());
        assertEquals("Carlos", savedAdmin.getFirstName());
        assertEquals("Admin", savedAdmin.getLastName());
        assertTrue(savedAdmin.isMustChangePassword());
        assertEquals("hashed-temp-password", savedAdmin.getPasswordHash());

        // Verificar asignación del rol 'Administrador de tenant'
        verify(roleRepository).assign(eq(savedTenant.getId()), eq(savedAdmin.getId()), eq(10L));

        // Verificar envío del correo con credenciales
        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    void updateAndGetSettings_WorksCorrectly() {
        UUID tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setName("Clinica San Jose");
        tenant.setPrimaryColor("#087f7b");
        tenant.setCurrency("USD");
        tenant.setTimezone("America/La_Paz");

        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        TenantSettingsUpdateRequest update = new TenantSettingsUpdateRequest(
                "#123456",
                "https://cdn.example.com/logo.png",
                "EUR",
                "Europe/Madrid",
                "DD/MM/YYYY",
                "es"
        );

        TenantSettingsResponse response = tenantService.updateSettings(tenantId, update);

        assertEquals("#123456", response.primaryColor());
        assertEquals("https://cdn.example.com/logo.png", response.logoUrl());
        assertEquals("EUR", response.currency());
        assertEquals("Europe/Madrid", response.timezone());
        assertEquals("DD/MM/YYYY", response.dateFormat());
    }
}
