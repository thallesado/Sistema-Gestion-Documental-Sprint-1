package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    
    // Buscar rol por nombre dentro de un tenant específico
    Optional<Role> findByNameAndTenantId(String name, UUID tenantId);

    // Buscar rol global de sistema por nombre
    Optional<Role> findByNameAndIsSystemTrue(String name);
}
