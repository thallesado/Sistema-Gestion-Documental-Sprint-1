package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TenantDatabaseNameTest {
    @Test
    void derivesStablePostgresSafeNameFromTenantUuid() {
        assertEquals("nexodocs_t_20000000000000000000000000000001",
                TenantDatabaseName.forTenant(UUID.fromString("20000000-0000-0000-0000-000000000001")));
    }

    @Test
    void rejectsClientControlledOrMalformedDatabaseIdentifiers() {
        assertThrows(IllegalArgumentException.class, () -> TenantDatabaseName.validate("other_database"));
        assertThrows(IllegalArgumentException.class, () -> TenantDatabaseName.validate("nexodocs_t_abc; DROP DATABASE x"));
        assertThrows(IllegalArgumentException.class, () -> TenantDatabaseName.forTenant(null));
    }
}
