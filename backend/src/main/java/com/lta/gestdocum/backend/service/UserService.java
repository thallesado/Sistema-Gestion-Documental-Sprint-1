package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.exception.TenantMismatchException;
import com.lta.gestdocum.backend.model.ClinicalStaff;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.ClinicalStaffRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.Set;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ClinicalStaffRepository clinicalStaffRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedUserContext authenticatedUserContext;
    private final com.lta.gestdocum.backend.repository.RoleRepository roleRepository;
    private final com.lta.gestdocum.backend.repository.TenantRepository tenantRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public UserService(UserRepository userRepository, 
                       ClinicalStaffRepository clinicalStaffRepository, 
                       PasswordEncoder passwordEncoder,
                       AuthenticatedUserContext authenticatedUserContext,
                       com.lta.gestdocum.backend.repository.RoleRepository roleRepository,
                       com.lta.gestdocum.backend.repository.TenantRepository tenantRepository) {
        this.userRepository = userRepository;
        this.clinicalStaffRepository = clinicalStaffRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticatedUserContext = authenticatedUserContext;
        this.roleRepository = roleRepository;
        this.tenantRepository = tenantRepository;
    }
    public UserService(UserRepository u, ClinicalStaffRepository c, PasswordEncoder p, AuthenticatedUserContext a) {
        this(u,c,p,a,null,null);
    }

    @Transactional
    @SuppressWarnings("null")
    public UserResponse createUser(UserCreateRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        if (request.getTenantId() != null && !tenantId.equals(request.getTenantId())) {
            throw new TenantMismatchException();
        }
        User user = User.builder()
                .tenantId(tenantId)
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .status(User.UserStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);
        assignRoles(tenantId, savedUser.getId(), request.getRoleIds());

        String staffTypeStr = null;
        String specialtyStr = null;

        if (request.getStaffType() != null) {
            ClinicalStaff staff = ClinicalStaff.builder()
                    .tenantId(tenantId)
                    .user(savedUser)
                    .staffType(request.getStaffType())
                    .specialty(request.getSpecialty())
                    .professionalLicense(request.getProfessionalLicense())
                    .build();
            clinicalStaffRepository.save(staff);
            staffTypeStr = staff.getStaffType().name();
            specialtyStr = staff.getSpecialty();
        }

        return mapToResponse(savedUser, staffTypeStr, specialtyStr);
    }
    @Transactional
    @SuppressWarnings("null")
    public UserResponse updateUser(UUID id, UserUpdateRequest request) {
    UUID tenantId = authenticatedUserContext.requireTenantId();
    authenticatedUserContext.establishDatabaseContext();
    User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
            .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));

    user.setFirstName(request.getFirstName());
    user.setLastName(request.getLastName());
    user.setEmail(request.getEmail());
    if (request.getStatus() != null) {
        User.UserStatus status = User.UserStatus.valueOf(request.getStatus().toUpperCase());
        if (id.equals(authenticatedUserContext.requireUserId()) && status != User.UserStatus.ACTIVE)
            throw new IllegalArgumentException("No puede desactivarse o bloquearse a sí mismo");
        user.setStatus(status);
    }

    User updatedUser = userRepository.save(user);
    if (request.getRoleIds() != null) {
    requireRoleAssignmentPermission();
    assignRoles(tenantId, id, request.getRoleIds());
    }

    String staffTypeStr = null;
    String specialtyStr = null;

    Optional<ClinicalStaff> staffOpt = clinicalStaffRepository.findByUserIdAndTenantId(id, tenantId);
    if (staffOpt.isPresent()) {
        ClinicalStaff staff = staffOpt.get();
        if (request.getStaffType() != null) {
            staff.setStaffType(request.getStaffType());
            staff.setSpecialty(request.getSpecialty());
            staff.setProfessionalLicense(request.getProfessionalLicense());
            clinicalStaffRepository.save(staff);
        }
        staffTypeStr = staff.getStaffType().name();
        specialtyStr = staff.getSpecialty();
    }

    return mapToResponse(updatedUser, staffTypeStr, specialtyStr);
}
    @Transactional
    @SuppressWarnings("null")
    public void deleteUser(UUID id) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        if (id.equals(authenticatedUserContext.requireUserId()))
            throw new IllegalArgumentException("No puede desactivarse a sí mismo");
        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));
        user.setDeletedAt(OffsetDateTime.now());
        user.setStatus(User.UserStatus.INACTIVE);
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findUsers(String filter, Pageable pageable) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        String normalizedFilter = filter == null || filter.isBlank() ? null : filter.trim();
        return userRepository.findActiveByTenant(tenantId, normalizedFilter, pageable)
                .map(user -> {
                    Optional<ClinicalStaff> staff = clinicalStaffRepository
                            .findByUserIdAndTenantId(user.getId(), tenantId);
                    return mapToResponse(
                            user,
                            staff.map(value -> value.getStaffType().name()).orElse(null),
                            staff.map(ClinicalStaff::getSpecialty).orElse(null));
                });
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        UUID userId = authenticatedUserContext.requireUserId();
        UUID tenantId = authenticatedUserContext.require().tenantId();
        if (tenantId != null) authenticatedUserContext.establishDatabaseContext();
        User user = tenantId == null
                ? userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"))
                : userRepository.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));
        Optional<ClinicalStaff> staff = tenantId == null
                ? clinicalStaffRepository.findByUserIdAndTenantIdIsNull(userId)
                : clinicalStaffRepository.findByUserIdAndTenantId(userId, tenantId);
        return mapToResponse(
                user,
                staff.map(value -> value.getStaffType().name()).orElse(null),
                staff.map(ClinicalStaff::getSpecialty).orElse(null));
    }

    private UserResponse mapToResponse(User user, String staffType, String specialty) {
        return UserResponse.builder()
                .id(user.getId())
                .tenantId(user.getTenantId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .status(user.getStatus().name())
                .tenantName(user.getTenantId() == null || tenantRepository == null ? null
                        : tenantRepository.findById(user.getTenantId()).map(t -> t.getName()).orElse(null))
                .platformAdmin(user.isPlatformAdmin())
                .staffType(staffType)
                .specialty(specialty)
                .roleIds(roleRepository == null || user.getTenantId() == null ? Set.of()
                        : roleRepository.findIds(user.getTenantId(), user.getId()))
                .roleNames(roleRepository == null || user.getTenantId() == null
                        ? (user.isPlatformAdmin() ? Set.of("SUPER_ADMIN") : Set.of())
                        : roleRepository.findNames(user.getTenantId(), user.getId()))
                .build();
    }
    private void assignRoles(UUID tenantId, UUID userId, Set<Long> ids) {
        if (ids == null) return;
        if (roleRepository == null) throw new IllegalStateException("Repositorio de roles no disponible");
        var roles = roleRepository.findActiveInTenant(tenantId, ids);
        if (roles.size() != ids.size() || roles.stream().anyMatch(r -> "Superadmin".equalsIgnoreCase(r.getName())))
            throw new IllegalArgumentException("Rol inválido para un usuario de tenant");
        roleRepository.clear(tenantId, userId);
        roles.forEach(r -> roleRepository.assign(tenantId, userId, r.getId()));
    }

    private void requireRoleAssignmentPermission() {
        if (!authenticatedUserContext.hasAuthority("role:assign")
                && !authenticatedUserContext.hasAuthority("user:manage")) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Se requiere permiso para asignar roles");
        }
    }
}
