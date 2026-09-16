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

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ClinicalStaffRepository clinicalStaffRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedUserContext authenticatedUserContext;

    public UserService(UserRepository userRepository, 
                       ClinicalStaffRepository clinicalStaffRepository, 
                       PasswordEncoder passwordEncoder,
                       AuthenticatedUserContext authenticatedUserContext) {
        this.userRepository = userRepository;
        this.clinicalStaffRepository = clinicalStaffRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticatedUserContext = authenticatedUserContext;
    }

    @Transactional
    @SuppressWarnings("null")
    public UserResponse createUser(UserCreateRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
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
    User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
            .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));

    user.setFirstName(request.getFirstName());
    user.setLastName(request.getLastName());
    user.setEmail(request.getEmail());

    User updatedUser = userRepository.save(user);

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
        User user = userRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));
        user.setDeletedAt(OffsetDateTime.now());
        user.setStatus(User.UserStatus.INACTIVE);
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findUsers(String filter, Pageable pageable) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
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
                .staffType(staffType)
                .specialty(specialty)
                .build();
    }
}
