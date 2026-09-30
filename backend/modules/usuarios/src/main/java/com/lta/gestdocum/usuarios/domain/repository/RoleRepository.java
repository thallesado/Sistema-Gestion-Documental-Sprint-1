package com.lta.gestdocum.usuarios.domain.repository;

import com.lta.gestdocum.usuarios.domain.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import java.util.Set;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;

public interface RoleRepository extends JpaRepository<Role, Long> {
    List<Role> findByTenantIdAndIsActiveTrueOrderByNameAsc(UUID tenantId);
    List<Role> findByTenantIdOrderByNameAsc(UUID tenantId);
    @Query("select r from Role r where r.tenantId=:tenantId and r.id in :ids and r.isActive=true")
    List<Role> findActiveInTenant(@Param("tenantId") UUID tenantId, @Param("ids") Set<Long> ids);
    @Query(value="select role_id from user_roles where tenant_id=:tenantId and user_id=:userId", nativeQuery=true)
    Set<Long> findIds(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
    @Query(value="select r.name from roles r join user_roles ur on ur.role_id=r.id and ur.tenant_id=r.tenant_id where ur.tenant_id=:tenantId and ur.user_id=:userId and r.is_active=true order by r.name", nativeQuery=true)
    Set<String> findNames(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
    @Modifying @Query(value="delete from user_roles where tenant_id=:tenantId and user_id=:userId", nativeQuery=true)
    void clear(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
    @Modifying @Query(value="insert into user_roles(tenant_id,user_id,role_id) values (:tenantId,:userId,:roleId)", nativeQuery=true)
    void assign(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId, @Param("roleId") Long roleId);
    
    Optional<Role> findByTenantIdAndNameIgnoreCase(UUID tenantId, String name);
    @Query(value="select count(*) from user_roles where tenant_id=:tenantId and role_id=:roleId", nativeQuery=true)
    long countUsers(@Param("tenantId") UUID tenantId, @Param("roleId") Long roleId);

    // Buscar rol por nombre dentro de un tenant específico
    Optional<Role> findByNameAndTenantId(String name, UUID tenantId);

    // Buscar rol global de sistema por nombre
    Optional<Role> findByNameAndIsSystemTrue(String name);

    Optional<Role> findByIdAndTenantId(Long id, UUID tenantId);

    @Query(value="select permission_id from role_permissions where tenant_id=:tenantId and role_id=:roleId", nativeQuery=true)
    Set<Long> findPermissionIds(@Param("tenantId") UUID tenantId, @Param("roleId") Long roleId);

    @Modifying @Query(value="delete from role_permissions where tenant_id=:tenantId and role_id=:roleId", nativeQuery=true)
    void clearPermissions(@Param("tenantId") UUID tenantId, @Param("roleId") Long roleId);

    @Modifying @Query(value="insert into role_permissions(tenant_id,role_id,permission_id) values (:tenantId,:roleId,:permissionId)", nativeQuery=true)
    void grantPermission(@Param("tenantId") UUID tenantId, @Param("roleId") Long roleId, @Param("permissionId") Long permissionId);
}
