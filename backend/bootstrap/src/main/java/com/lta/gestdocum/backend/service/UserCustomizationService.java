package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCustomizationDtos.CurrentUserCustomization;
import com.lta.gestdocum.backend.dto.UserCustomizationDtos.UserCustomizationRequest;
import com.lta.gestdocum.backend.dto.UserCustomizationDtos.UserCustomizationResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.UserCustomizationRepository;
import com.lta.gestdocum.backend.repository.UserCustomizationRepository.Row;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Personalización de usuarios del tenant (permiso user:customize): perfil, interfaz, notificaciones,
 * vigencia y horario de acceso, y límites documentales. También aplica esas restricciones al
 * iniciar sesión, al renovar la sesión, al subir archivos y al crear documentos.
 */
@Service
public class UserCustomizationService {

    /** Pantallas de inicio admitidas; la interfaz además comprueba el permiso de la ruta. */
    static final Set<String> LANDING_PAGES = Set.of("/", "/documents", "/documents/mine", "/documents/shared",
            "/documents/recent", "/expedients", "/clinical/patients", "/digitization", "/digitization/ocr",
            "/workflows", "/workflows/tasks", "/reports", "/audit");
    private static final long BYTES_PER_MB = 1024L * 1024L;
    private static final String DEFAULT_TIMEZONE = "America/La_Paz";

    private final UserCustomizationRepository repository;
    private final UserRepository userRepository;
    private final AuthenticatedUserContext context;
    private final AuthSessionService authSessionService;
    private AuditRecorder auditRecorder;

    public UserCustomizationService(UserCustomizationRepository repository, UserRepository userRepository,
                                    AuthenticatedUserContext context, AuthSessionService authSessionService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.context = context;
        this.authSessionService = authSessionService;
    }

    @Autowired(required = false)
    public void setAuditRecorder(AuditRecorder auditRecorder) {
        this.auditRecorder = auditRecorder;
    }

    @Transactional(readOnly = true)
    public UserCustomizationResponse get(UUID userId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        User user = requireUser(userId, tenantId);
        return toResponse(user, tenantId);
    }

    @Transactional
    public UserCustomizationResponse update(UUID userId, UserCustomizationRequest request) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        User user = requireUser(userId, tenantId);
        Row previous = repository.find(tenantId, userId).orElse(Row.EMPTY);
        Set<UUID> previousTypes = repository.findAllowedDocumentTypes(tenantId, userId);
        boolean previousMustChange = user.isMustChangePassword();

        Row next = validated(request);
        Set<UUID> types = request.allowedDocumentTypeIds() == null ? Set.of() : Set.copyOf(request.allowedDocumentTypeIds());
        if (repository.countActiveDocumentTypes(tenantId, types) != types.size()) {
            throw new IllegalArgumentException("Hay tipos documentales inexistentes o inactivos en la selección");
        }
        boolean self = userId.equals(context.requireUserId());
        boolean accessChanged = !next.accessPolicy().equals(previous.accessPolicy())
                || (request.mustChangePassword() && !previousMustChange);
        if (self && accessChanged) {
            throw new IllegalArgumentException("No puede cambiar su propio acceso: pida a otro administrador que lo haga");
        }

        user.setPhone(blankToNull(request.phone()));
        user.setBiography(blankToNull(request.biography()));
        user.setEmailNotifications(request.emailNotifications());
        user.setPushNotifications(request.pushNotifications());
        user.setMustChangePassword(request.mustChangePassword());
        if (next.language() != null) user.setPreferredLanguage(next.language());
        userRepository.save(user);
        repository.upsert(tenantId, userId, next, context.requireUserId());
        repository.replaceAllowedDocumentTypes(tenantId, userId, types);

        // Las restricciones nuevas se aplican en el siguiente inicio de sesión: se cierran las abiertas.
        if (accessChanged) authSessionService.revokeAll(userId);
        if (auditRecorder != null) {
            auditRecorder.record("UPDATE", "USER_CUSTOMIZATIONS", userId,
                    snapshot(previous, previousTypes, previousMustChange), snapshot(next, types, request.mustChangePassword()));
        }
        return toResponse(user, tenantId);
    }

    /** Cierra todas las sesiones del usuario (no la propia, para eso está cerrar sesión). */
    @Transactional
    public void revokeSessions(UUID userId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        requireUser(userId, tenantId);
        if (userId.equals(context.requireUserId())) {
            throw new IllegalArgumentException("Para cerrar su propia sesión use la opción Cerrar sesión");
        }
        authSessionService.revokeAll(userId);
        if (auditRecorder != null) {
            auditRecorder.record("REVOKE_SESSIONS", "USERS", userId, null, Map.of("sessions", "revoked"));
        }
    }

    /** Lo que /auth/me devuelve al propio usuario. Llamar con el contexto RLS ya establecido. */
    public CurrentUserCustomization currentFor(UUID tenantId, UUID userId) {
        Row row = repository.find(tenantId, userId).orElse(Row.EMPTY);
        return new CurrentUserCustomization(row.jobTitle(), row.language(), row.landingPage(),
                row.maxUploadMb(), row.storageQuotaMb(), repository.findAllowedDocumentTypes(tenantId, userId));
    }

    /**
     * Comprueba vigencia y horario al iniciar o renovar sesión. Se ejecuta sin contexto RLS, igual que
     * la lectura de users y user_roles en AuthService.
     */
    public void assertAccessAllowed(User user) {
        if (user.getTenantId() == null) return;
        UserAccessPolicy policy = repository.find(user.getTenantId(), user.getId())
                .map(Row::accessPolicy).orElse(UserAccessPolicy.UNRESTRICTED);
        if (!policy.restricted()) return;
        String reason = policy.denialReason(ZonedDateTime.now(zone(user.getTenantId())));
        if (reason != null) throw new AccessDeniedException(reason);
    }

    /** Tamaño máximo por archivo y cuota del usuario actual. Llamar con el contexto RLS ya establecido. */
    public void validateUpload(UUID tenantId, long fileBytes) {
        UUID userId = context.requireUserId();
        Row row = repository.find(tenantId, userId).orElse(null);
        if (row == null) return;
        if (row.maxUploadMb() != null && fileBytes > row.maxUploadMb() * BYTES_PER_MB) {
            throw new IllegalArgumentException("El archivo supera el máximo de " + row.maxUploadMb()
                    + " MB configurado para su usuario");
        }
        if (row.storageQuotaMb() != null
                && repository.storageBytes(userId) + fileBytes > row.storageQuotaMb() * BYTES_PER_MB) {
            throw new IllegalArgumentException("Se alcanzó la cuota de almacenamiento de " + row.storageQuotaMb()
                    + " MB configurada para su usuario");
        }
    }

    /** Tipos documentales permitidos al usuario actual. Llamar con el contexto RLS ya establecido. */
    public void validateDocumentType(UUID tenantId, UUID documentTypeId) {
        Set<UUID> allowed = repository.findAllowedDocumentTypes(tenantId, context.requireUserId());
        if (!allowed.isEmpty() && (documentTypeId == null || !allowed.contains(documentTypeId))) {
            throw new AccessDeniedException("Su usuario no tiene habilitado este tipo documental");
        }
    }

    private Row validated(UserCustomizationRequest request) {
        String landing = blankToNull(request.landingPage());
        if (landing != null && !LANDING_PAGES.contains(landing)) {
            throw new IllegalArgumentException("Pantalla de inicio no admitida: " + landing);
        }
        if ((request.accessStartTime() == null) != (request.accessEndTime() == null)) {
            throw new IllegalArgumentException("El horario de acceso necesita hora de inicio y de fin");
        }
        if (request.accessStartTime() != null && request.accessStartTime().equals(request.accessEndTime())) {
            throw new IllegalArgumentException("La hora de inicio y la de fin no pueden coincidir");
        }
        Set<Integer> weekdays = request.accessWeekdays() == null ? Set.of() : new TreeSet<>(request.accessWeekdays());
        if (weekdays.stream().anyMatch(day -> day == null || day < 1 || day > 7)) {
            throw new IllegalArgumentException("Los días de acceso van de 1 (lunes) a 7 (domingo)");
        }
        // Los siete días equivalen a no restringir.
        if (weekdays.size() == 7) weekdays = Set.of();
        return new Row(blankToNull(request.jobTitle()), blankToNull(request.language()), landing,
                request.accessExpiresOn(), weekdays,
                request.accessStartTime() == null ? null : request.accessStartTime().withSecond(0).withNano(0),
                request.accessEndTime() == null ? null : request.accessEndTime().withSecond(0).withNano(0),
                request.maxUploadMb(), request.storageQuotaMb());
    }

    private UserCustomizationResponse toResponse(User user, UUID tenantId) {
        Row row = repository.find(tenantId, user.getId()).orElse(Row.EMPTY);
        return new UserCustomizationResponse(user.getId(), user.getUsername(),
                (user.getFirstName() + " " + user.getLastName()).trim(),
                row.jobTitle(), user.getPhone(), user.getBiography(), row.language(), row.landingPage(),
                user.isEmailNotifications(), user.isPushNotifications(), user.isMustChangePassword(),
                row.accessExpiresOn(), row.accessWeekdays(), row.accessStartTime(), row.accessEndTime(),
                row.maxUploadMb(), row.storageQuotaMb(), repository.findAllowedDocumentTypes(tenantId, user.getId()),
                repository.storageBytes(user.getId()), zone(tenantId).getId(),
                authSessionService.hasActiveSession(user.getId()),
                user.getId().equals(context.requireUserId()));
    }

    private User requireUser(UUID userId, UUID tenantId) {
        return userRepository.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)
                .orElseThrow(() -> new NotFoundException("Usuario no encontrado"));
    }

    private ZoneId zone(UUID tenantId) {
        try {
            return ZoneId.of(repository.tenantTimezone(tenantId).filter(value -> !value.isBlank()).orElse(DEFAULT_TIMEZONE));
        } catch (DateTimeException exception) {
            return ZoneId.of(DEFAULT_TIMEZONE);
        }
    }

    private static Map<String, Object> snapshot(Row row, Set<UUID> types, boolean mustChangePassword) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("jobTitle", Objects.toString(row.jobTitle(), ""));
        values.put("language", Objects.toString(row.language(), ""));
        values.put("landingPage", Objects.toString(row.landingPage(), ""));
        values.put("accessExpiresOn", Objects.toString(row.accessExpiresOn(), ""));
        values.put("accessWeekdays", row.accessWeekdays().toString());
        values.put("accessHours", row.accessStartTime() == null ? "" : row.accessStartTime() + "-" + row.accessEndTime());
        values.put("maxUploadMb", Objects.toString(row.maxUploadMb(), ""));
        values.put("storageQuotaMb", Objects.toString(row.storageQuotaMb(), ""));
        values.put("allowedDocumentTypes", new TreeSet<>(types).toString());
        values.put("mustChangePassword", mustChangePassword);
        return values;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
