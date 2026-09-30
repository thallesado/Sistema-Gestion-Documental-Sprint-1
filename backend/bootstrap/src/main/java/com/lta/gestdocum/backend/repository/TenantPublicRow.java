package com.lta.gestdocum.backend.repository;

import java.util.UUID;

/** Proyección de app.list_login_tenants(): solo id y nombre. */
public interface TenantPublicRow {
    UUID getId();
    String getName();
}
