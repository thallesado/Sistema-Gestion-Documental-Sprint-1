package com.lta.gestdocum.usuarios.application.service;

import com.lta.gestdocum.usuarios.application.dto.UserResponse;
import com.lta.gestdocum.usuarios.domain.model.ClinicalStaff;
import com.lta.gestdocum.usuarios.domain.model.Tenant;
import com.lta.gestdocum.usuarios.domain.model.User;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class UserMapper {

    public UserResponse toUserResponse(User user, ClinicalStaff staff, Set<Long> roleIds, Set<String> roleNames, Tenant tenant) {
        return UserResponse.builder()
                .id(user.getId())
                .tenantId(user.getTenantId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .tenantName(tenant != null ? tenant.getName() : null)
                .platformAdmin(user.isPlatformAdmin())
                .staffType(staff != null && staff.getStaffType() != null ? staff.getStaffType().name() : null)
                .specialty(staff != null ? staff.getSpecialty() : null)
                .roleIds(roleIds != null ? roleIds : Set.of())
                .roleNames(roleNames != null ? roleNames : Set.of())
                .build();
    }
}
