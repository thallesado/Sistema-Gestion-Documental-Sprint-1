package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.Role;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoleGrantPolicyTest {
    private static Role role(String name) {
        Role role = mock(Role.class);
        when(role.getName()).thenReturn(name);
        return role;
    }

    @Test
    void anActorCanGrantAGroupWhoseEveryPermissionTheyAlreadyHold() {
        assertDoesNotThrow(() -> RoleGrantPolicy.requireGrantable(
                List.of(role("Supervisor")), Set.of("document:read", "task:read"),
                Set.of("document:read", "task:read", "role:assign", "workflow:read")));
    }

    @Test
    void anActorCannotGrantAGroupWithPermissionsTheyLack() {
        // A clinic administrator must not be able to hand out (or take) tenant-administrator permissions.
        assertThrows(AccessDeniedException.class, () -> RoleGrantPolicy.requireGrantable(
                List.of(role("Administrador de tenant")), Set.of("document:read", "backup:restore", "billing:manage"),
                Set.of("document:read", "role:assign")));
    }

    @Test
    void groupsNamedAfterThePlatformSuperadminAreNeverGrantedToTenantUsers() {
        Set<String> everything = Set.of("document:read");
        for (String name : new String[] {"Superadmin", "Superadministrador", "SUPERADMINISTRADOR"}) {
            assertThrows(IllegalArgumentException.class, () -> RoleGrantPolicy.requireGrantable(
                    List.of(role(name)), Set.of("document:read"), everything), name);
        }
    }

    @Test
    void grantingNothingNewNeverFails() {
        assertDoesNotThrow(() -> RoleGrantPolicy.requireGrantable(List.of(), Set.of(), Set.of()));
    }
}
