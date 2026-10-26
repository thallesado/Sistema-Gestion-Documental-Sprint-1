package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.model.*;
import com.lta.gestdocum.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);

    private final TenantRepository repository;
    private final PlanRepository planRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @Value("${app.mail-from:diegoastetepaz@gmail.com}")
    private String mailFrom;

    @org.springframework.beans.factory.annotation.Autowired
    public TenantService(
            TenantRepository repository,
            PlanRepository planRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            PasswordEncoder passwordEncoder,
            org.springframework.beans.factory.ObjectProvider<JavaMailSender> mailSenderProvider,
            org.springframework.beans.factory.ObjectProvider<org.springframework.jdbc.core.JdbcTemplate> jdbcTemplateProvider) {
        this.repository = repository;
        this.planRepository = planRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSenderProvider != null ? mailSenderProvider.getIfAvailable() : null;
        this.jdbcTemplate = jdbcTemplateProvider != null ? jdbcTemplateProvider.getIfAvailable() : null;
    }

    public TenantService(
            TenantRepository repository,
            PlanRepository planRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            PasswordEncoder passwordEncoder,
            org.springframework.beans.factory.ObjectProvider<JavaMailSender> mailSenderProvider) {
        this(repository, planRepository, userRepository, roleRepository, permissionRepository, passwordEncoder, mailSenderProvider, null);
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> list() {
        return repository.findAll().stream().map(this::map).toList();
    }

    /** Organizaciones que pueden iniciar sesión (ACTIVE y TRIAL), solo id y nombre. */
    @Transactional(readOnly = true)
    public List<TenantPublicResponse> listPublic() {
        return repository.findLoginTenants().stream()
                .map(t -> new TenantPublicResponse(t.getId(), t.getName())).toList();
    }

    /**
     * Alta completa de organización (A1).
     * En la misma transacción crea el tenant, le asigna el plan (o BASIC por defecto),
     * crea a su usuario administrador inicial con contraseña temporal y obligatoriedad
     * de cambio al entrar, le asigna el rol 'Administrador de tenant' y le envía correo con accesos.
     */
    @Transactional
    public TenantResponse create(TenantCreateRequest r) {
        return create(r, null);
    }

    /**
     * Único recorrido de creación de organizaciones (alta por superadmin, /public/signup y /public/onboarding).
     * Con {@code adminPassword} el administrador elige su contraseña: no queda marcada como temporal y no se
     * envía correo con credenciales. Sin ella se genera una temporal que se envía por correo y debe cambiarse.
     */
    @Transactional
    public TenantResponse create(TenantCreateRequest r, String adminPassword) {
        boolean ownPassword = adminPassword != null && !adminPassword.isBlank();
        UUID tenantId = UUID.randomUUID();
        Tenant t = new Tenant();
        t.setId(tenantId);
        t.setName(r.name().trim());
        t.setCode(r.code().trim());
        t.setSlug(r.slug().trim());
        t.setEmail(r.email().trim().toLowerCase(Locale.ROOT));
        t.setStatus(Tenant.Status.TRIAL);

        // Asignar plan solicitado o BASIC por defecto
        UUID planId = r.planId();
        if (planId == null) {
            planId = planRepository.findFirstByCodeIgnoreCaseAndActiveTrue("BASIC")
                    .map(Plan::getId)
                    .orElse(null);
        }
        t.setPlanId(planId);

        Instant now = Instant.now();
        t.setPrimaryColor("#087f7b");
        t.setTrialStartAt(now);
        t.setTrialEndsAt(now.plus(12, ChronoUnit.DAYS));
        t.setBillingCycle("MONTHLY");
        t.setCurrency("USD");
        t.setTimezone("America/La_Paz");
        t.setDateFormat("YYYY-MM-DD");
        t.setDefaultLanguage("es");

        Tenant saved = repository.save(t);

        // Crear administrador inicial
        String adminEmail = (r.adminEmail() != null && !r.adminEmail().isBlank())
                ? r.adminEmail().trim().toLowerCase(Locale.ROOT)
                : r.email().trim().toLowerCase(Locale.ROOT);
        String adminFullName = (r.adminName() != null && !r.adminName().isBlank())
                ? r.adminName().trim()
                : r.name().trim() + " Admin";

        String[] nameParts = adminFullName.split("\\s+", 2);
        String firstName = nameParts[0];
        String lastName = nameParts.length > 1 ? nameParts[1] : "Administrador";

        String suffix = tenantId.toString().substring(0, 8);
        String username = deriveUsername(adminEmail, suffix);
        String tempPassword = ownPassword ? null : generateTemporaryPassword();

        User adminUser = User.builder()
                .tenantId(tenantId)
                .username(username)
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(ownPassword ? adminPassword : tempPassword))
                .firstName(firstName)
                .lastName(lastName)
                .status(UserStatus.ACTIVE)
                .mustChangePassword(!ownPassword)
                .preferredLanguage("es")
                .build();
        userRepository.save(adminUser);

        // Asignar rol "Administrador de tenant"
        Role adminRole = roleRepository.save(Role.builder()
                .tenantId(tenantId)
                .name("Administrador de tenant")
                .description("Administrador inicial creado durante el alta de la organización")
                .isSystem(true)
                .isActive(true)
                .build());
        roleRepository.assign(tenantId, adminUser.getId(), adminRole.getId());

        // Conceder únicamente los permisos permitidos por las funcionalidades del plan contratado
        try {
            List<String> enabledFeatures = planId == null ? List.of() : planRepository.findFeaturesByPlanId(planId).stream()
                    .filter(f -> Boolean.TRUE.equals(f.getEnabled()))
                    .map(PlanFeatureProjection::getFeatureKey)
                    .toList();
            java.util.Set<String> featureSet = new java.util.HashSet<>(enabledFeatures);

            permissionRepository.findByIsActiveTrueOrderByModuleAscActionAsc().stream()
                    .filter(perm -> PlanFeatureMatrix.isPermissionAllowed(perm.getModule(), perm.getCode(), featureSet))
                    .forEach(perm -> roleRepository.grantPermission(tenantId, adminRole.getId(), perm.getId()));
        } catch (Exception ex) {
            log.warn("Aviso al otorgar permisos al rol de tenant admin: {}", ex.getMessage());
        }

        // Enviar correo con credenciales de acceso de forma defensiva
        if (!ownPassword) sendWelcomeEmail(saved, adminUser, tempPassword);

        // Sembrar catálogos base (departamentos, categorías y tipos documentales)
        seedDefaultCatalogs(saved.getId());

        return map(saved);
    }

    public void seedDefaultCatalogs(UUID tenantId) {
        if (jdbcTemplate == null || tenantId == null) {
            return;
        }
        try {
            jdbcTemplate.update("""
                INSERT INTO document_categories (id, tenant_id, name, code)
                VALUES 
                    (gen_random_uuid(), ?, 'Legal', 'LEGAL'),
                    (gen_random_uuid(), ?, 'Clinico', 'CLINICAL'),
                    (gen_random_uuid(), ?, 'Administrativo', 'ADMIN'),
                    (gen_random_uuid(), ?, 'Financiero', 'FINANCE')
                ON CONFLICT DO NOTHING
            """, tenantId, tenantId, tenantId, tenantId);

            jdbcTemplate.update("""
                INSERT INTO retention_policies (id, tenant_id, name, retention_months, disposition_action)
                VALUES 
                    (gen_random_uuid(), ?, 'General 5 anos', 60, 'REVIEW'),
                    (gen_random_uuid(), ?, 'Custodia permanente', NULL, 'ARCHIVE')
                ON CONFLICT DO NOTHING
            """, tenantId, tenantId);

            jdbcTemplate.update("""
                INSERT INTO tenant_departments (id, tenant_id, name, code, description)
                VALUES 
                    (gen_random_uuid(), ?, 'Direccion General', 'DIR', 'Alta direccion y gerencia general'),
                    (gen_random_uuid(), ?, 'Administracion y Finanzas', 'ADM', 'Gestion financiera y administrativa'),
                    (gen_random_uuid(), ?, 'Legal y Cumplimiento', 'LEG', 'Asuntos juridicos y cumplimiento normativo'),
                    (gen_random_uuid(), ?, 'Archivo Central', 'ARCH', 'Custodia y gestion documental'),
                    (gen_random_uuid(), ?, 'Servicios Medicos / Consulta', 'MED', 'Atencion en salud y consultas'),
                    (gen_random_uuid(), ?, 'Recursos Humanos', 'RRHH', 'Gestion de talento humano y personal')
                ON CONFLICT DO NOTHING
            """, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId);

            jdbcTemplate.update("""
                INSERT INTO document_types (id, tenant_id, category_id, retention_policy_id, name, code, description, metadata_schema)
                SELECT 
                    gen_random_uuid(),
                    ?,
                    (SELECT dc.id FROM document_categories dc WHERE dc.tenant_id = ? AND dc.code = dt.cat_code LIMIT 1),
                    (SELECT rp.id FROM retention_policies rp WHERE rp.tenant_id = ? LIMIT 1),
                    dt.name,
                    dt.code,
                    dt.description,
                    '{}'::jsonb
                FROM (VALUES
                    ('Contrato', 'CONTRACT', 'LEGAL', 'Contratos y acuerdos comerciales'),
                    ('Informe Tecnico', 'TECH_REPORT', 'ADMIN', 'Informes tecnicos y peritajes'),
                    ('Historia Clinica', 'CLINICAL_HISTORY', 'CLINICAL', 'Expedientes e historiales medicos'),
                    ('Factura / Comprobante', 'INVOICE', 'FINANCE', 'Facturacion y documentacion contable'),
                    ('Acta de Reunion', 'MINUTES', 'ADMIN', 'Actas de directorio y comites'),
                    ('Consentimiento Informado', 'CONSENT', 'CLINICAL', 'Formularios de consentimiento y autorizacion'),
                    ('Correspondencia Oficial', 'OFFICIAL_LETTER', 'ADMIN', 'Comunicaciones institucionales')
                ) AS dt(name, code, cat_code, description)
                ON CONFLICT DO NOTHING
            """, tenantId, tenantId, tenantId);
        } catch (Exception ex) {
            log.warn("Aviso al sembrar catalogos por defecto para el tenant {}: {}", tenantId, ex.getMessage());
        }
    }

    @Transactional
    public TenantResponse changeStatus(UUID id, String value) {
        Tenant t = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));
        t.setStatus(Tenant.Status.valueOf(value.toUpperCase(Locale.ROOT)));
        return map(repository.save(t));
    }

    @Transactional(readOnly = true)
    public TenantSettingsResponse getSettings(UUID tenantId) {
        Tenant t = repository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));
        return new TenantSettingsResponse(
                t.getId(),
                t.getName(),
                t.getPrimaryColor(),
                t.getLogoUrl(),
                t.getCurrency() != null ? t.getCurrency() : "USD",
                t.getTimezone() != null ? t.getTimezone() : "America/La_Paz",
                t.getDateFormat() != null ? t.getDateFormat() : "YYYY-MM-DD",
                t.getDefaultLanguage() != null ? t.getDefaultLanguage() : "es"
        );
    }

    @Transactional
    public TenantSettingsResponse updateSettings(UUID tenantId, TenantSettingsUpdateRequest request) {
        Tenant t = repository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));
        if (request.primaryColor() != null && !request.primaryColor().isBlank()) {
            t.setPrimaryColor(request.primaryColor().trim());
        }
        if (request.logoUrl() != null) {
            t.setLogoUrl(request.logoUrl().trim().isEmpty() ? null : request.logoUrl().trim());
        }
        if (request.currency() != null && !request.currency().isBlank()) {
            t.setCurrency(request.currency().trim().toUpperCase(Locale.ROOT));
        }
        if (request.timezone() != null && !request.timezone().isBlank()) {
            t.setTimezone(request.timezone().trim());
        }
        if (request.dateFormat() != null && !request.dateFormat().isBlank()) {
            t.setDateFormat(request.dateFormat().trim());
        }
        if (request.defaultLanguage() != null && !request.defaultLanguage().isBlank()) {
            t.setDefaultLanguage(request.defaultLanguage().trim().toLowerCase(Locale.ROOT));
        }

        Tenant updated = repository.save(t);
        return getSettings(updated.getId());
    }

    private void sendWelcomeEmail(Tenant tenant, User adminUser, String tempPassword) {
        if (mailSender == null) {
            log.warn("JavaMailSender no disponible; no se envió la contraseña temporal de {} a {} (usuario={}). "
                            + "Usa la recuperación de contraseña para definir una nueva.",
                    tenant.getName(), adminUser.getEmail(), adminUser.getUsername());
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(adminUser.getEmail());
            message.setSubject("Bienvenido a NexoDocs - Credenciales de acceso");
            message.setText("¡Bienvenido a NexoDocs!\n\n"
                    + "Se ha creado exitosamente la organización: " + tenant.getName() + "\n"
                    + "Tus credenciales de administrador inicial son:\n\n"
                    + "  Organización: " + tenant.getName() + " (" + tenant.getCode() + ")\n"
                    + "  Usuario: " + adminUser.getUsername() + "\n"
                    + "  Correo: " + adminUser.getEmail() + "\n"
                    + "  Contraseña temporal: " + tempPassword + "\n\n"
                    + "Por motivos de seguridad, deberás cambiar tu contraseña al iniciar sesión por primera vez.\n\n"
                    + "Accede a la plataforma en:\n"
                    + frontendUrl + "/login\n\n"
                    + "Atentamente,\nEl equipo de NexoDocs");
            mailSender.send(message);
            log.info("Correo de bienvenida enviado exitosamente a {}", adminUser.getEmail());
        } catch (Exception ex) {
            log.warn("No se pudo enviar el correo de bienvenida SMTP a {}: {}. Las credenciales se generaron correctamente.",
                    adminUser.getEmail(), ex.getMessage());
        }
    }

    private String deriveUsername(String email, String suffix) {
        String local = email.substring(0, email.indexOf('@')).replaceAll("[^A-Za-z0-9_.-]", "");
        if (local.isBlank()) local = "admin";
        return local.substring(0, Math.min(50, local.length())) + "-" + suffix;
    }

    private String generateTemporaryPassword() {
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghijkmnpqrstuvwxyz";
        String digits = "23456789";
        String specials = "!@#$%&*";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        sb.append(upper.charAt(random.nextInt(upper.length())));
        sb.append(lower.charAt(random.nextInt(lower.length())));
        sb.append(digits.charAt(random.nextInt(digits.length())));
        sb.append(specials.charAt(random.nextInt(specials.length())));
        for (int i = 0; i < 6; i++) {
            String all = upper + lower + digits + specials;
            sb.append(all.charAt(random.nextInt(all.length())));
        }
        return sb.toString();
    }

    private TenantResponse map(Tenant t) {
        return new TenantResponse(
                t.getId(),
                t.getName(),
                t.getCode(),
                t.getSlug(),
                t.getStatus() != null ? t.getStatus().name() : "TRIAL",
                t.getPlanId(),
                t.getLogoUrl(),
                t.getPrimaryColor()
        );
    }
}
