package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class UserResponse {
    private UUID id;
    private UUID tenantId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String status;
    private String tenantName;
    private String tenantLogoUrl;
    private boolean platformAdmin;
    /** true si la contraseña es temporal y debe cambiarse antes de usar el sistema. */
    private boolean mustChangePassword;
    private String staffType;
    private String specialty;
    private String phone;
    private String biography;
    private boolean hasAvatar;
    private boolean emailNotifications;
    private boolean pushNotifications;
    private java.util.Set<Long> roleIds;
    private java.util.Set<String> roleNames;
    /** Solo se informa en /auth/me: permisos efectivos calculados desde user_roles y role_permissions. */
    private java.util.List<String> permissions;
    private String planCode;
    private java.util.List<String> enabledFeatures;
    /** Solo en /auth/me: personalización definida por un administrador (user:customize). */
    private UserCustomizationDtos.CurrentUserCustomization customization;
}

