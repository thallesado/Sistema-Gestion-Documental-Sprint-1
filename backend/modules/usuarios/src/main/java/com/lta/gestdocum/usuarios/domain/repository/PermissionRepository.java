package com.lta.gestdocum.usuarios.domain.repository;

import com.lta.gestdocum.usuarios.domain.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    List<Permission> findByIsActiveTrueOrderByModuleAscActionAsc();
}
