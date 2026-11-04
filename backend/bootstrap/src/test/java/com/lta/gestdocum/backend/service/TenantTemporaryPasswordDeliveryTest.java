package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.model.Role;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.PermissionRepository;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * La clave temporal de un administrador generado por la plataforma solo se devuelve al superadmin cuando el
 * correo no pudo entregarla; el alta pública (clave elegida por la persona) nunca la expone.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TenantTemporaryPasswordDeliveryTest {

    @Mock private TenantRepository tenantRepository;
    @Mock private PlanRepository planRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JavaMailSender mailSender;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;

    private TenantService service;

    @BeforeEach
    void setUp() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(passwordEncoder.encode(anyString())).thenAnswer(invocation -> "hash:" + invocation.getArgument(0));
        service = new TenantService(tenantRepository, planRepository, userRepository, roleRepository,
                permissionRepository, passwordEncoder, mailSenderProvider);
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> {
            Role role = invocation.getArgument(0);
            role.setId(10L);
            return role;
        });
        when(permissionRepository.findByIsActiveTrueOrderByModuleAscActionAsc()).thenReturn(Collections.emptyList());
    }

    private TenantCreateRequest request() {
        return new TenantCreateRequest("Clinica Norte", "NORTE-01", "clinica-norte", "contacto@norte.test",
                UUID.randomUUID(), "admin@norte.test", "Ana Admin");
    }

    @Test
    @DisplayName("Con el correo entregado la respuesta no incluye la clave temporal")
    void deliveredEmailKeepsThePasswordOutOfTheResponse() {
        TenantResponse response = service.create(request());

        verify(mailSender).send(any(SimpleMailMessage.class));
        assertNull(response.temporaryPassword());
    }

    @Test
    @DisplayName("Si el correo falla, el superadmin recibe la clave temporal una vez y es la misma que se guardó")
    void failedEmailReturnsTheGeneratedPasswordOnce() {
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(SimpleMailMessage.class));

        TenantResponse response = service.create(request());

        assertNotNull(response.temporaryPassword());
        assertTrue(response.temporaryPassword().length() >= 10);
        ArgumentCaptor<User> admin = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(admin.capture());
        assertEquals("hash:" + response.temporaryPassword(), admin.getValue().getPasswordHash());
        assertTrue(admin.getValue().isMustChangePassword());
    }

    @Test
    @DisplayName("Sin servidor de correo configurado también se devuelve la clave temporal")
    void missingMailSenderReturnsTheGeneratedPassword() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(null);
        TenantService withoutMail = new TenantService(tenantRepository, planRepository, userRepository, roleRepository,
                permissionRepository, passwordEncoder, mailSenderProvider);

        TenantResponse response = withoutMail.create(request());

        assertNotNull(response.temporaryPassword());
    }

    @Test
    @DisplayName("El alta con clave elegida por la persona nunca expone ninguna clave")
    void ownPasswordNeverExposesAnything() {
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(SimpleMailMessage.class));

        TenantResponse response = service.create(request(), "ClaveElegida#2026");

        assertNull(response.temporaryPassword());
    }
}
