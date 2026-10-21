package com.lta.gestdocum.backend.dto;

import lombok.Data;

@Data
public class NotificationPreferencesRequest {
    private boolean emailNotifications;
    private boolean pushNotifications;
}
