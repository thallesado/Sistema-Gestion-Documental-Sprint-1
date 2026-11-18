package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.Role;
import org.springframework.security.access.AccessDeniedException;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;

/** Rules for granting groups to a tenant user: nobody can hand out more power than they hold. */
final class RoleGrantPolicy {
    private RoleGrantPolicy() { }

    /**
     * @param added groups being newly granted (groups the user already had are not re-checked)
     * @param requiredPermissions every permission code held by those groups
     * @param actorHolds whether whoever is granting holds a given authority
     */
    static void requireGrantable(Collection<Role> added, Set<String> requiredPermissions, Predicate<String> actorHolds) {
        // "Superadmin"/"Superadministrador" name the platform account; they are not groups a tenant user can receive.
        if (added.stream().anyMatch(role -> role.getName() != null
                && role.getName().toLowerCase(Locale.ROOT).startsWith("superadmin"))) {
            throw new IllegalArgumentException("Rol inválido para un usuario de tenant");
        }
        Set<String> missing = new TreeSet<>(requiredPermissions);
        missing.removeIf(actorHolds);
        if (!missing.isEmpty()) {
            throw new AccessDeniedException("No puedes asignar un grupo con permisos que no tienes");
        }
    }
}
