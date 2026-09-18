package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;
import java.util.Set;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    List<Role> findByTenantIdAndIsActiveTrueOrderByNameAsc(UUID tenantId);
    @Query("select r from Role r where r.tenantId=:tenantId and r.id in :ids and r.isActive=true")
    List<Role> findActiveInTenant(@Param("tenantId") UUID tenantId, @Param("ids") Set<Long> ids);
    @Query(value="select role_id from user_roles where tenant_id=:tenantId and user_id=:userId", nativeQuery=true)
    Set<Long> findIds(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
    @Modifying @Query(value="delete from user_roles where tenant_id=:tenantId and user_id=:userId", nativeQuery=true)
    void clear(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
    @Modifying @Query(value="insert into user_roles(tenant_id,user_id,role_id) values (:tenantId,:userId,:roleId)", nativeQuery=true)
    void assign(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId, @Param("roleId") Long roleId);
    
    // Buscar rol por nombre dentro de un tenant específico
    Optional<Role> findByNameAndTenantId(String name, UUID tenantId);

    // Buscar rol global de sistema por nombre
    Optional<Role> findByNameAndIsSystemTrue(String name);
}
