package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    List<Permission> findByIsActiveTrueOrderByModuleAscActionAsc();
}
