package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUser;

public interface HttpAuditRecorder {
    void record(AuthenticatedUser user, String method, String path, int status,
                String ipAddress, String userAgent);
}
