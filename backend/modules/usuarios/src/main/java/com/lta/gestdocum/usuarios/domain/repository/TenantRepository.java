package com.lta.gestdocum.usuarios.domain.repository;

import com.lta.gestdocum.usuarios.domain.model.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    /** Lectura pública vía función SECURITY DEFINER (evita la RLS de tenants antes de autenticar). */
    @org.springframework.data.jpa.repository.Query(value = "SELECT id, name FROM app.list_login_tenants()", nativeQuery = true)
    List<TenantPublicRow> findLoginTenants();
    Optional<Tenant> findFirstBySlugIgnoreCase(String slug);
    Optional<Tenant> findFirstByCodeIgnoreCase(String code);
    Optional<Tenant> findFirstByNameIgnoreCase(String name);
}
