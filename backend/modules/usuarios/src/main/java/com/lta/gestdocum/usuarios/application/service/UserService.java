package com.lta.gestdocum.usuarios.application.service;

import com.lta.gestdocum.shared.exception.DuplicateResourceException;
import com.lta.gestdocum.shared.exception.NotFoundException;
import com.lta.gestdocum.shared.exception.TenantMismatchException;
import com.lta.gestdocum.shared.security.AuthenticatedUserContext;
import com.lta.gestdocum.shared.support.CrudTextSupport;
import com.lta.gestdocum.usuarios.application.dto.UserCreateRequest;
import com.lta.gestdocum.usuarios.application.dto.UserResponse;
import com.lta.gestdocum.usuarios.application.dto.UserUpdateRequest;
import com.lta.gestdocum.usuarios.domain.model.*;
import com.lta.gestdocum.usuarios.domain.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final ClinicalStaffRepository clinicalStaffRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedUserContext authenticatedUserContext;
    private final RoleRepository roleRepository;
    private final TenantRepository tenantRepository;
    private final UserSessionRevocationPort authSessionService;
    private final UserMapper userMapper;

    public UserService(UserRepository userRepository,
                       ClinicalStaffRepository clinicalStaffRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticatedUserContext authenticatedUserContext,
                       RoleRepository roleRepository,
                       TenantRepository tenantRepository,
                       UserSessionRevocationPort authSessionService,
                       UserMapper userMapper) {
        this.userRepository = userRepository;
        this.clinicalStaffRepository = clinicalStaffRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticatedUserContext = authenticatedUserContext;
        this.roleRepository = roleRepository;
        this.tenantRepository = tenantRepository;
        this.authSessionService = authSessionService;
        this.userMapper = userMapper;
    }

    @Transactional
    public UserResponse createUser(UserCreateRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        if (request.getTenantId() != null && !tenantId.equals(request.getTenantId())) {
            throw new TenantMismatchException();
        }
        if (userRepository.existsByTenantIdAndUsernameIgnoreCase(tenantId, request.getUsername())) {
            throw new DuplicateResourceException("El nombre de usuario '" + request.getUsername() + "' ya está en uso");
        }
        if (userRepository.existsByTenantIdAndEmailIgnoreCase(tenantId, request.getEmail())) {
            throw new DuplicateResourceException("El correo '" + request.getEmail() + "' ya está registrado");
        }
        User user = User.builder()
                .tenantId(tenantId)
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .status(UserStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);
        userRepository.flush();
        assignRoles(tenantId, savedUser.getId(), request.getRoleIds());

        ClinicalStaff staff = null;
        if (request.getStaffType() != null) {
            staff = clinicalStaffRepository.save(ClinicalStaff.builder()
                    .tenantId(tenantId)
                    .user(savedUser)
                    .staffType(request.getStaffType())
                    .specialty(request.getSpecialty())
                    .build());
        }

        Set<Long> roleIds = roleRepository != null ? roleRepository.findIds(tenantId, savedUser.getId()) : Set.of();
        Set<String> roleNames = roleRepository != null ? roleRepository.findNames(tenantId, savedUser.getId()) : Set.of();
        Tenant tenant = tenantRepository != null ? tenantRepository.findById(tenantId).orElse(null) : null;
        return userMapper.toUserResponse(savedUser, staff, roleIds, roleNames, tenant);
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findUsers(String search, Pageable pageable) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        Page<User> page = userRepository.findActiveByTenant(tenantId, search, pageable);
        Tenant tenant = tenantRepository != null ? tenantRepository.findById(tenantId).orElse(null) : null;
        return page.map(user -> toResponse(user, tenantId, tenant));
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findResponsibleUsers(String search, Pageable pageable) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        Page<User> page = userRepository.findResponsibleByTenant(tenantId, search, pageable);
        Tenant tenant = tenantRepository != null ? tenantRepository.findById(tenantId).orElse(null) : null;
        return page.map(user -> toResponse(user, tenantId, tenant));
    }

    @Transactional(readOnly = true)
    public UserResponse findUserById(UUID id) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));
        Tenant tenant = tenantRepository != null ? tenantRepository.findById(tenantId).orElse(null) : null;
        return toResponse(user, tenantId, tenant);
    }

    @Transactional
    public UserResponse updateUser(UUID id, UserUpdateRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));

        if (request.getEmail() != null && !request.getEmail().equalsIgnoreCase(user.getEmail())) {
            if (userRepository.existsByTenantIdAndEmailIgnoreCase(tenantId, request.getEmail())) {
                throw new DuplicateResourceException("El correo ya está en uso");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getStatus() != null) user.setStatus(UserStatus.valueOf(request.getStatus()));

        if (request.getRoleIds() != null) {
            assignRoles(tenantId, user.getId(), request.getRoleIds());
        }

        ClinicalStaff staff = clinicalStaffRepository.findByUserIdAndTenantId(user.getId(), tenantId).orElse(null);
        if (request.getStaffType() != null) {
            if (staff == null) {
                staff = ClinicalStaff.builder().tenantId(tenantId).user(user).build();
            }
            staff.setStaffType(StaffType.valueOf(request.getStaffType()));
            if (request.getSpecialty() != null) staff.setSpecialty(request.getSpecialty());
            staff = clinicalStaffRepository.save(staff);
        }

        User saved = userRepository.save(user);
        Tenant tenant = tenantRepository != null ? tenantRepository.findById(tenantId).orElse(null) : null;
        return toResponse(saved, tenantId, tenant);
    }

    @Transactional
    public void deleteUser(UUID id) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));

        if (authSessionService != null) {
            authSessionService.revokeAll(id);
        }
        clinicalStaffRepository.findByUserIdAndTenantId(id, tenantId).ifPresent(clinicalStaffRepository::delete);
        if (roleRepository != null) {
            roleRepository.clear(tenantId, id);
        }
        user.setDeletedAt(OffsetDateTime.now());
        userRepository.save(user);
    }

    private UserResponse toResponse(User user, UUID tenantId, Tenant tenant) {
        ClinicalStaff staff = clinicalStaffRepository.findByUserIdAndTenantId(user.getId(), tenantId).orElse(null);
        Set<Long> roleIds = roleRepository != null ? roleRepository.findIds(tenantId, user.getId()) : Set.of();
        Set<String> roleNames = roleRepository != null ? roleRepository.findNames(tenantId, user.getId()) : Set.of();
        return userMapper.toUserResponse(user, staff, roleIds, roleNames, tenant);
    }

    private void assignRoles(UUID tenantId, UUID userId, Set<Long> roleIds) {
        if (roleRepository == null) return;
        roleRepository.clear(tenantId, userId);
        if (roleIds != null) {
            for (Long roleId : roleIds) {
                roleRepository.assign(tenantId, userId, roleId);
            }
        }
    }
}
