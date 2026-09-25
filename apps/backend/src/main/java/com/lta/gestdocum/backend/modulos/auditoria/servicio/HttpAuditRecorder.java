package com.lta.gestdocum.backend.modulos.auditoria.servicio;

import com.lta.gestdocum.backend.comun.seguridad.AuthenticatedUser;

public interface HttpAuditRecorder {
    void record(AuthenticatedUser user, String method, String path, int status,
                String ipAddress, String userAgent);
}
