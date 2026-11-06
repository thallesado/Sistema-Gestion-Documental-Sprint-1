package com.lta.gestdocum.backend.service;

import java.util.UUID;

/** Generates the only supported PostgreSQL database identifier for a tenant. */
public final class TenantDatabaseName {
    private static final String PREFIX = "nexodocs_t_";

    private TenantDatabaseName() { }

    public static String forTenant(UUID tenantId) {
        if (tenantId == null) throw new IllegalArgumentException("tenantId is required");
        return PREFIX + tenantId.toString().replace("-", "");
    }

    /** Validates a registry value before it is used as an SQL identifier. */
    public static String validate(String databaseName) {
        if (databaseName == null || !databaseName.matches("^nexodocs_t_[0-9a-f]{32}$")) {
            throw new IllegalArgumentException("Invalid tenant database identifier");
        }
        return databaseName;
    }
}
