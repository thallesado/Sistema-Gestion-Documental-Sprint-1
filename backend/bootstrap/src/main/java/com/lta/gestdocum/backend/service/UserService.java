package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.dto.ProfileUpdateRequest;
import com.lta.gestdocum.backend.dto.NotificationPreferencesRequest;
import com.lta.gestdocum.backend.dto.PasswordChangeRequest;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.exception.TenantMismatchException;
import com.lta.gestdocum.backend.model.ClinicalStaff;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
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
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final ClinicalStaffRepository clinicalStaffRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedUserContext authenticatedUserContext;
    private final com.lta.gestdocum.backend.repository.RoleRepository roleRepository;
    private final com.lta.gestdocum.backend.repository.TenantRepository tenantRepository;
    private final AuthSessionService authSessionService;
    private final PlanEnforcementService planEnforcementService;
    private final UserFormPolicy userFormPolicy;
    private AuditRecorder auditRecorder;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.lta.gestdocum.backend.repository.PlanRepository planRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setAuditRecorder(AuditRecorder auditRecorder) {
        this.auditRecorder = auditRecorder;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public UserService(UserRepository userRepository,
                       ClinicalStaffRepository clinicalStaffRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticatedUserContext authenticatedUserContext,
                       com.lta.gestdocum.backend.repository.RoleRepository roleRepository,
                       com.lta.gestdocum.backend.repository.TenantRepository tenantRepository,
                       AuthSessionService authSessionService,
                       PlanEnforcementService planEnforcementService,
                       UserFormPolicy userFormPolicy) {
        this.userRepository = userRepository;
        this.clinicalStaffRepository = clinicalStaffRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticatedUserContext = authenticatedUserContext;
        this.roleRepository = roleRepository;
        this.tenantRepository = tenantRepository;
        this.authSessionService = authSessionService;
        this.planEnforcementService = planEnforcementService;
        this.userFormPolicy = userFormPolicy;
    }
    public UserService(UserRepository u, ClinicalStaffRepository c, PasswordEncoder p, AuthenticatedUserContext a) {
        this(u,c,p,a,null,null,null,null,new UserFormPolicy());
    }

    @Transactional
    @SuppressWarnings("null")
    public UserResponse createUser(UserCreateRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        if (request.getTenantId() != null && !tenantId.equals(request.getTenantId())) {
            throw new TenantMismatchException();
        }
        userFormPolicy.validateCreate(request);
        planEnforcementService.validateUserLimit(tenantId);
        if (userRepository.existsByTenantIdAndUsernameIgnoreCase(tenantId, request.getUsername())) {
            throw new com.lta.gestdocum.backend.exception.DuplicateResourceException(
                    "El nombre de usuario '" + request.getUsername() + "' ya está en uso");
        }
        if (userRepository.existsByTenantIdAndEmailIgnoreCase(tenantId, request.getEmail())) {
            throw new com.lta.gestdocum.backend.exception.DuplicateResourceException(
                    "El correo '" + request.getEmail() + "' ya está registrado");
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

        log.info("[CREATE-USER] Guardando usuario tenantId={} username={} passwordEncoded={}",
                tenantId, user.getUsername(), user.getPasswordHash() != null && user.getPasswordHash().startsWith("$2"));
        User savedUser = userRepository.save(user);
        userRepository.flush(); // fuerza el INSERT aquí para que cualquier error de BD se vea en este punto
        if (auditRecorder != null) {
            auditRecorder.record("CREATE", "USERS", savedUser.getId(), null,
                    java.util.Map.of("username", savedUser.getUsername(), "email", savedUser.getEmail(), "status", String.valueOf(savedUser.getStatus())));
        }
        log.info("[CREATE-USER] Usuario guardado id={}; asignando roleIds={}", savedUser.getId(), request.getRoleIds());
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
    userFormPolicy.validateUpdate(user, request);

    UserStatus previousStatus = user.getStatus();
    user.setFirstName(request.getFirstName());
    user.setLastName(request.getLastName());
    user.setEmail(request.getEmail());
    if (request.getStatus() != null) {
        UserStatus status = UserStatus.valueOf(request.getStatus().toUpperCase());
        if (id.equals(authenticatedUserContext.requireUserId()) && status != UserStatus.ACTIVE)
            throw new IllegalArgumentException("No puede desactivarse o bloquearse a sí mismo");
        user.setStatus(status);
    }

    User updatedUser = userRepository.save(user);
    if (auditRecorder != null) {
        auditRecorder.record("UPDATE", "USERS", updatedUser.getId(),
                java.util.Map.of("status", String.valueOf(previousStatus)),
                java.util.Map.of("status", String.valueOf(updatedUser.getStatus()), "email", updatedUser.getEmail()));
    }
    if (updatedUser.getStatus() != previousStatus) authSessionService.revokeAll(id);
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
        user.setStatus(UserStatus.INACTIVE);
        User deleted = userRepository.save(user);
        if (auditRecorder != null) {
            auditRecorder.record("DELETE", "USERS", deleted.getId(),
                    java.util.Map.of("status", "ACTIVE", "username", deleted.getUsername()),
                    java.util.Map.of("status", "INACTIVE", "deleted", true));
        }
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findUsers(String filter, Pageable pageable) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        String normalizedFilter = filter == null || filter.isBlank() ? null : filter.trim();
        return userFormPolicy.hideComponents(userRepository.findActiveByTenant(tenantId, normalizedFilter, pageable)
                .map(user -> {
                    Optional<ClinicalStaff> staff = clinicalStaffRepository
                            .findByUserIdAndTenantId(user.getId(), tenantId);
                    return mapToResponse(
                            user,
                            staff.map(value -> value.getStaffType().name()).orElse(null),
                            staff.map(ClinicalStaff::getSpecialty).orElse(null));
                }));
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findResponsibleUsers(String filter, Pageable pageable) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        String normalizedFilter = filter == null || filter.isBlank() ? null : filter.trim();
        return userRepository.findResponsibleByTenant(tenantId, normalizedFilter, pageable)
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
        UserResponse response = mapToResponse(
                user,
                staff.map(value -> value.getStaffType().name()).orElse(null),
                staff.map(ClinicalStaff::getSpecialty).orElse(null));
        // Los permisos se toman del JWT de la sesión, que son los que autorizan cada petición.
        // No se vuelven a consultar con el contexto RLS: user_roles y role_permissions solo son
        // legibles con role:read y un perfil sin ese permiso recibiría una lista vacía.
        response.setPermissions(user.isPlatformAdmin()
                ? com.lta.gestdocum.backend.security.PlatformAuthorities.CODES
                : tenantId == null ? java.util.List.of() : sessionPermissions());
        if (tenantId != null && roleRepository != null) {
            // Igual que los permisos: los grupos propios se leen sin depender de role:read.
            response.setRoleIds(roleRepository.findCurrentIds());
            response.setRoleNames(roleRepository.findCurrentNames());
        }
        if (tenantId != null && planRepository != null) {
            planRepository.findPlanCodeByTenantId(tenantId).ifPresent(response::setPlanCode);
            response.setEnabledFeatures(planRepository.findEnabledFeatureKeysByTenantId(tenantId));
        }
        return response;
    }

    @Transactional
    public UserResponse updateCurrentProfile(ProfileUpdateRequest request) {
        User user = currentUserEntity();
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(request.getEmail().trim());
        user.setPhone(blankToNull(request.getPhone()));
        user.setBiography(blankToNull(request.getBiography()));
        return mapToResponse(userRepository.save(user), currentStaffType(user), currentSpecialty(user));
    }

    @Transactional
    public UserResponse updateCurrentAvatar(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("La imagen es obligatoria");
        if (file.getSize() > 2L * 1024 * 1024) throw new IllegalArgumentException("La imagen no puede superar 2 MB");
        String contentType = file.getContentType();
        if (contentType == null || !Set.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new IllegalArgumentException("Formato de imagen no permitido");
        }
        try {
            User user = currentUserEntity();
            user.setAvatarData(file.getBytes());
            user.setAvatarContentType(contentType);
            return mapToResponse(userRepository.save(user), currentStaffType(user), currentSpecialty(user));
        } catch (java.io.IOException exception) {
            throw new IllegalArgumentException("No se pudo leer la imagen", exception);
        }
    }

    @Transactional(readOnly = true)
    public AvatarFile currentAvatar() {
        User user = currentUserEntity();
        if (user.getAvatarData() == null || user.getAvatarData().length == 0) {
            throw new NotFoundException("El usuario no tiene una foto de perfil");
        }
        return new AvatarFile(user.getAvatarData(), user.getAvatarContentType());
    }

    @Transactional
    public UserResponse updateNotificationPreferences(NotificationPreferencesRequest request) {
        User user = currentUserEntity();
        user.setEmailNotifications(request.isEmailNotifications());
        user.setPushNotifications(request.isPushNotifications());
        return mapToResponse(userRepository.save(user), currentStaffType(user), currentSpecialty(user));
    }

    @Transactional
    public void changeCurrentPassword(PasswordChangeRequest request) {
        User user = currentUserEntity();
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("La contraseña actual no es correcta");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    private User currentUserEntity() {
        UUID userId = authenticatedUserContext.requireUserId();
        UUID tenantId = authenticatedUserContext.require().tenantId();
        if (tenantId != null) authenticatedUserContext.establishDatabaseContext();
        return tenantId == null
                ? userRepository.findByIdAndDeletedAtIsNull(userId)
                    .orElseThrow(() -> new NotFoundException("Usuario no encontrado"))
                : userRepository.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)
                    .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));
    }

    private String currentStaffType(User user) {
        if (user.getTenantId() == null) return null;
        return clinicalStaffRepository.findByUserIdAndTenantId(user.getId(), user.getTenantId())
                .map(staff -> staff.getStaffType().name()).orElse(null);
    }

    private String currentSpecialty(User user) {
        if (user.getTenantId() == null) return null;
        return clinicalStaffRepository.findByUserIdAndTenantId(user.getId(), user.getTenantId())
                .map(ClinicalStaff::getSpecialty).orElse(null);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Códigos de permiso del JWT actual, sin las authorities ROLE_* de emisores antiguos. */
    private java.util.List<String> sessionPermissions() {
        return authenticatedUserContext.require().authorities().stream()
                .filter(code -> !code.startsWith("ROLE_"))
                .sorted()
                .toList();
    }

    private UserResponse mapToResponse(User user, String staffType, String specialty) {
        com.lta.gestdocum.backend.model.Tenant tenant = user.getTenantId() == null || tenantRepository == null
                ? null
                : tenantRepository.findById(user.getTenantId()).orElse(null);
        return UserResponse.builder()
                .id(user.getId())
                .tenantId(user.getTenantId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .status(user.getStatus().name())
                .tenantName(tenant == null ? null : tenant.getName())
                .tenantLogoUrl(tenant == null ? null : tenant.getLogoUrl())
                .platformAdmin(user.isPlatformAdmin())
                .staffType(staffType)
                .specialty(specialty)
                .phone(user.getPhone())
                .biography(user.getBiography())
                .hasAvatar(user.getAvatarData() != null && user.getAvatarData().length > 0)
                .emailNotifications(user.isEmailNotifications())
                .pushNotifications(user.isPushNotifications())
                .roleIds(roleRepository == null || user.getTenantId() == null ? Set.of()
                        : roleRepository.findIds(user.getTenantId(), user.getId()))
                .roleNames(roleRepository == null || user.getTenantId() == null
                        ? (user.isPlatformAdmin() ? Set.of("SUPER_ADMIN") : Set.of())
                        : roleRepository.findNames(user.getTenantId(), user.getId()))
                .build();
    }
    private void assignRoles(UUID tenantId, UUID userId, Set<Long> ids) {
        if (ids == null) return;
        if (ids.isEmpty()) throw new IllegalArgumentException("La lista de roles no puede estar vacía");
        if (roleRepository == null) throw new IllegalStateException("Repositorio de roles no disponible");
        var roles = roleRepository.findActiveInTenant(tenantId, ids);
        if (roles.size() != ids.size() || roles.stream().anyMatch(r -> "Superadmin".equalsIgnoreCase(r.getName())))
            throw new IllegalArgumentException("Rol inválido para un usuario de tenant");
        if (!ids.equals(roleRepository.findIds(tenantId, userId))) authSessionService.revokeAll(userId);
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

    public record AvatarFile(byte[] data, String contentType) { }
}
