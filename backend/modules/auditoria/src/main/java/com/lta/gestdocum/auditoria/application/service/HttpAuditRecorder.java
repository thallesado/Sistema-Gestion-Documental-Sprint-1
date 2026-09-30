package com.lta.gestdocum.auditoria.application.service;

import com.lta.gestdocum.shared.security.AuthenticatedUser;

public interface HttpAuditRecorder {
    void record(AuthenticatedUser user, String method, String path, int status,
                String ipAddress, String userAgent);
}
