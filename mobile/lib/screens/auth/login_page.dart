import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/constants/api_constants.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../shell/main_shell_page.dart';
import '../password_page.dart';
import '../expedients/public_radicacion_page.dart';
import '../../core/i18n/app_language.dart';

/// Valor del selector para el administrador de plataforma (sin organización), como en la web.
const platformTenant = '';

/// Modo de acceso seleccionado para ofrecer la mejor experiencia UI/UX.
enum LoginAccessMode {
  administrative,
  citizen,
}

/// Rol o perfil detectado de forma inteligente según el correo o usuario.
enum DetectedUserRole {
  unknown,
  ownerOrAdmin,
  supervisor,
  operative,
  healthcare,
  citizen,
}

/// Organizaciones por defecto para garantizar inicialización inmediata y resiliente ante fallas de red.
const defaultPublicTenants = [
  PublicTenant('20000000-0000-0000-0000-000000000001', 'FinoCode'),
  PublicTenant('20000000-0000-0000-0000-000000000002', 'Clínica Central'),
];

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.authApi,
    this.notice,
    this.lockedMode = false,
    this.onUnlocked,
    this.onFullLogout,
    this.demoHints = kDebugMode,
  });

  final AuthApi authApi;

  /// Pistas de la demo: adivinar el perfil por el correo y preseleccionar las organizaciones del seed.
  /// Solo en debug: con usuarios reales un correo como "mariana@…" elegiría la organización equivocada.
  final bool demoHints;

  /// Aviso informativo, p. ej. cuando la sesión expiró.
  final String? notice;

  /// Pantalla de desbloqueo: sesión guardada + huella activa. Solo muestra la tarjeta de huella
  /// (y "Usar contraseña") hasta que el usuario verifica la huella o cierra sesión completa.
  final bool lockedMode;

  /// Se llama cuando la huella se verificó y la sesión se restauró.
  final VoidCallback? onUnlocked;

  /// Tras "Usar contraseña" (cierre completo) desde el bloqueo: mostrar el login normal.
  final VoidCallback? onFullLogout;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final formKey = GlobalKey<FormState>();
  final userController = TextEditingController();
  final passwordController = TextEditingController();
  List<PublicTenant> tenants = [];
  String? tenantId;
  bool tenantsLoading = true;
  String? tenantsError;
  bool submitting = false;
  bool showPassword = false;
  bool biometricEnabled = false;
  int biometricFailures = 0;
  static const maxBiometricAttempts = 3;
  String? error;

  LoginAccessMode accessMode = LoginAccessMode.administrative;
  DetectedUserRole detectedRole = DetectedUserRole.unknown;
  String? detectedRoleDescription;
  bool isMultiTenantOwner = false;

  @override
  void initState() {
    super.initState();
    userController.addListener(_handleUserChanged);
    loadTenants();
    biometricEnabled = widget.lockedMode;
    _checkBiometrics();
  }

  void _handleUserChanged() {
    if (!widget.demoHints) return;
    final text = userController.text.trim().toLowerCase();
    if (text.isEmpty) {
      if (detectedRole != DetectedUserRole.unknown) {
        setState(() {
          detectedRole = DetectedUserRole.unknown;
          detectedRoleDescription = null;
          isMultiTenantOwner = false;
        });
      }
      return;
    }

    DetectedUserRole role = DetectedUserRole.unknown;
    String? roleDesc;
    bool multi = false;
    String? autoTenant;

    if (text.contains('laura') || text.contains('superadmin') || text == 'carlos@nexodocs.com') {
      role = DetectedUserRole.ownerOrAdmin;
      roleDesc = text.contains('superadmin') ? context.tr('Superadministrador de Plataforma') : context.tr('Dueña / Administradora General');
      multi = true;
      autoTenant = text == 'carlos@nexodocs.com' ? platformTenant : '20000000-0000-0000-0000-000000000001';
    } else if (text.contains('clinicacentral') || text.contains('maria') || text.contains('medico')) {
      role = DetectedUserRole.healthcare;
      roleDesc = context.tr('Sector Salud / Personal Clínico');
      autoTenant = '20000000-0000-0000-0000-000000000002';
    } else if (text.contains('supervisor') || (text.contains('carlos') && !text.contains('nexodocs'))) {
      role = DetectedUserRole.supervisor;
      roleDesc = context.tr('Supervisor / Aprobador de Tareas');
      autoTenant = '20000000-0000-0000-0000-000000000001';
    } else if (text.contains('operativo') || text.contains('ana')) {
      role = DetectedUserRole.operative;
      roleDesc = context.tr('Funcionario Operativo / Radicación');
      autoTenant = '20000000-0000-0000-0000-000000000001';
    } else if (text.endsWith('@acme.com')) {
      role = DetectedUserRole.operative;
      roleDesc = context.tr('Funcionario FinoCode');
      autoTenant = '20000000-0000-0000-0000-000000000001';
    } else if (text.endsWith('@gmail.com') ||
               text.endsWith('@hotmail.com') ||
               text.endsWith('@yahoo.com') ||
               text.endsWith('@outlook.com') ||
               text.endsWith('@live.com') ||
               text.endsWith('@icloud.com') ||
               text.contains('ciudadano') ||
               text.contains('cliente') ||
               text.contains('paciente')) {
      role = DetectedUserRole.citizen;
      roleDesc = context.tr('Usuario Ciudadano / Cliente');
      autoTenant = '20000000-0000-0000-0000-000000000001';
    }

    setState(() {
      detectedRole = role;
      detectedRoleDescription = roleDesc;
      isMultiTenantOwner = multi;
      if (autoTenant != null && tenantId == null) {
        tenantId = autoTenant;
      }
      if (role == DetectedUserRole.citizen && accessMode != LoginAccessMode.citizen) {
        accessMode = LoginAccessMode.citizen;
      } else if (role != DetectedUserRole.citizen && role != DetectedUserRole.unknown && accessMode == LoginAccessMode.citizen) {
        accessMode = LoginAccessMode.administrative;
      }
    });
  }

  Future<void> _checkBiometrics() async {
    final enabled = await widget.authApi.biometrics.isEnabled();
    final hasSession = await widget.authApi.client.hasSession();
    if (mounted) {
      setState(() => biometricEnabled = enabled && hasSession);
    }
  }

  /// Formulario de contraseña visible: siempre fuera del modo bloqueado, o tras agotar los intentos de huella.
  bool get showPasswordForm => !widget.lockedMode || !biometricEnabled || biometricFailures >= maxBiometricAttempts;

  Future<void> _unlockWithBiometrics() async {
    if (biometricFailures >= maxBiometricAttempts) return;
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      final authenticated = await widget.authApi.biometrics.authenticate(
        reason: tr('Usa tu biometría para acceder a NexoDocs'),
      );
      if (!authenticated) {
        if (mounted) {
          setState(() {
            biometricFailures++;
            error = biometricFailures >= maxBiometricAttempts
                ? tr('Demasiados intentos con la huella. Ingresa tu contraseña.')
                : tr('La verificación con huella fue cancelada o falló.');
          });
        }
        return;
      }
      await widget.authApi.restoreProfile();
      if (!mounted) return;
      biometricFailures = 0;
      final onUnlocked = widget.onUnlocked;
      if (widget.lockedMode && onUnlocked != null) {
        onUnlocked();
        return;
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => widget.authApi.mustChangePassword
            ? PasswordPage(api: widget.authApi, requiredChange: true) : MainShellPage(api: widget.authApi)),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  /// "Usar contraseña": cierre completo (revoca la sesión, borra tokens y desactiva la huella).
  Future<void> _useFullLogout() async {
    setState(() {
      submitting = true;
      error = null;
    });
    await widget.authApi.logout();
    final onFullLogout = widget.onFullLogout;
    if (onFullLogout != null) {
      onFullLogout();
      return;
    }
    if (!mounted) return;
    setState(() {
      submitting = false;
      biometricEnabled = false;
      biometricFailures = 0;
    });
  }

  @override
  void dispose() {
    userController.removeListener(_handleUserChanged);
    userController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> loadTenants() async {
    setState(() {
      tenantsLoading = true;
      tenantsError = null;
    });
    try {
      final result = await widget.authApi.publicTenants();
      if (!mounted) return;
      setState(() {
        if (result.isNotEmpty) {
          tenants = result;
        }
        if (tenantId != null && tenantId != platformTenant && !tenants.any((t) => t.id == tenantId)) {
          tenantId = tenants.isNotEmpty ? tenants.first.id : platformTenant;
        }
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => tenantsError = 'No se pudo cargar la lista de organizaciones. ${exception.message}');
    } finally {
      if (mounted) setState(() => tenantsLoading = false);
    }
  }

  void showServerDialog() {
    final serverController = TextEditingController(text: apiBaseUrl);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('Servidor')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.tr('URL de la API de NexoDocs. Desde un teléfono usa la IP del equipo que ejecuta el backend.'),
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 10),
            TextField(
              key: const Key('server-url'),
              controller: serverController,
              keyboardType: TextInputType.url,
              decoration: InputDecoration(labelText: context.tr('URL del servidor'), hintText: defaultApiBaseUrl),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(context.tr('Cancelar'))),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await widget.authApi.client.saveServerUrl(serverController.text);
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Servidor: {url}', {'url': apiBaseUrl}))));
              loadTenants();
            },
            child: Text(context.tr('Guardar')),
          ),
        ],
      ),
    );
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      await widget.authApi.login(
        tenantId: tenantId ?? platformTenant,
        username: userController.text.trim(),
        password: passwordController.text,
      );
      await widget.authApi.restoreProfile();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => widget.authApi.mustChangePassword
            ? PasswordPage(api: widget.authApi, requiredChange: true) : MainShellPage(api: widget.authApi)),
      );
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  /// Rellena credenciales de demostración; solo en compilaciones de depuración.
  void fillDemo(String email, String? tenant) => setState(() {
    tenantId = tenant;
    userController.text = email;
    passwordController.text = 'DemoPass123!';
    accessMode = LoginAccessMode.administrative;
    error = null;
  });

  /// Rellena perfil ciudadano de demostración.
  void fillCitizenDemo(String email) => setState(() {
    tenantId = '20000000-0000-0000-0000-000000000001';
    userController.text = email;
    passwordController.clear();
    accessMode = LoginAccessMode.citizen;
    detectedRole = DetectedUserRole.citizen;
    detectedRoleDescription = context.tr('Usuario Ciudadano / Cliente');
    error = null;
  });

  Widget _tenantCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required String id,
  }) {
    final isSelected = tenantId == id;
    return InkWell(
      onTap: () => setState(() => tenantId = id),
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.teal.withValues(alpha: 0.1) : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.teal : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.teal : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                icon,
                size: 20,
                color: isSelected ? Colors.white : Colors.grey.shade700,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: isSelected ? AppTheme.teal : Colors.black87,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11,
                      color: isSelected ? AppTheme.teal.withValues(alpha: 0.8) : Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: AppTheme.teal, size: 18),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: Alignment.topRight,
                        child: IconButton(
                          icon: const Icon(Icons.settings_outlined, size: 20, color: Colors.grey),
                          tooltip: context.tr('Configurar servidor'),
                          onPressed: showServerDialog,
                        ),
                      ),
                      const Icon(Icons.folder_shared_outlined, size: 52, color: AppTheme.teal),
                      const SizedBox(height: 12),
                      Text('NexoDocs', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                      Text(context.tr('Gestión Documental y Radicación Inteligente'), textAlign: TextAlign.center),
                      if (biometricEnabled && accessMode == LoginAccessMode.administrative) ...[
                        const SizedBox(height: 16),
                        _biometricCard(),
                        if (showPasswordForm) ...[
                          const SizedBox(height: 16),
                          _orDivider(),
                          const SizedBox(height: 16),
                        ],
                      ],
                      if (widget.notice != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: const Color(0xfffef3c7), borderRadius: BorderRadius.circular(8)),
                          child: Text(widget.notice!, key: const Key('login-notice'), style: const TextStyle(fontSize: 13)),
                        ),
                      ],
                      const SizedBox(height: 20),

                      // Campo de Correo o Usuario
                      TextFormField(
                        key: const Key('username'),
                        controller: userController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
                        decoration: InputDecoration(
                          labelText: context.tr('Correo o usuario'),
                          prefixIcon: Icon(Icons.account_circle_outlined),
                        ),
                        validator: requiredField,
                      ),

                      // Badge dinámico de rol detectado
                      if (detectedRoleDescription != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: detectedRole == DetectedUserRole.citizen
                                ? const Color(0xfff0fdf4)
                                : const Color(0xffeff6ff),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: detectedRole == DetectedUserRole.citizen
                                  ? const Color(0xff86efac)
                                  : const Color(0xffbfdbfe),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                detectedRole == DetectedUserRole.citizen
                                    ? Icons.how_to_reg
                                    : (isMultiTenantOwner ? Icons.workspace_premium : Icons.badge),
                                size: 18,
                                color: detectedRole == DetectedUserRole.citizen
                                    ? const Color(0xff16a34a)
                                    : const Color(0xff2563eb),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  detectedRoleDescription!,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: detectedRole == DetectedUserRole.citizen
                                        ? const Color(0xff15803d)
                                        : const Color(0xff1d4ed8),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      if (showPasswordForm) ...[
                      // Conmutador Inteligente de Modo (Administrativo vs Ciudadano)
                      if (detectedRole != DetectedUserRole.unknown) ...[
                        const SizedBox(height: 14),
                        SegmentedButton<LoginAccessMode>(
                          segments: [
                            ButtonSegment<LoginAccessMode>(
                              value: LoginAccessMode.administrative,
                              icon: Icon(Icons.business_center_outlined, size: 16),
                              label: Text(context.tr('Administrativo'), style: TextStyle(fontSize: 12)),
                            ),
                            ButtonSegment<LoginAccessMode>(
                              value: LoginAccessMode.citizen,
                              icon: Icon(Icons.person_outline, size: 16),
                              label: Text(context.tr('Ciudadano'), style: TextStyle(fontSize: 12)),
                            ),
                          ],
                          selected: {accessMode},
                          onSelectionChanged: (newSelection) {
                            setState(() => accessMode = newSelection.first);
                          },
                        ),
                      ],

                      // MODO CIUDADANO / CLIENTE
                      if (accessMode == LoginAccessMode.citizen) ...[
                        Container(
                          margin: const EdgeInsets.only(top: 14),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xfff0fdfa),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xff99f6e4)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.verified_user_outlined, color: AppTheme.teal, size: 20),
                                  SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      context.tr('Portal Ciudadano y Radicación'),
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        color: AppTheme.teal,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                context.tr('Como ciudadano o usuario final no requieres contraseña corporativa. Puedes radicar trámites formalmente, firmar en pantalla, adjuntar fotos y consultar el avance de tus radicaciones.'),
                                style: TextStyle(fontSize: 12, color: Colors.black87),
                              ),
                              const SizedBox(height: 14),
                              FilledButton.icon(
                                key: const Key('citizen-portal-submit'),
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => PublicRadicacionPage(
                                      client: widget.authApi.client,
                                      authApi: widget.authApi,
                                      initialEmail: userController.text.trim(),
                                      initialTenantId: tenantId ?? '20000000-0000-0000-0000-000000000001',
                                    ),
                                  ),
                                ),
                                icon: const Icon(Icons.arrow_forward, size: 18),
                                label: Text(context.tr('Entrar a Ventanilla Ciudadana')),
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppTheme.teal,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Center(
                                child: TextButton(
                                  onPressed: () => setState(() => accessMode = LoginAccessMode.administrative),
                                  child: Text(
                                    context.tr('¿Eres funcionario con contraseña? Ingresar aquí'),
                                    style: TextStyle(fontSize: 12),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // MODO ADMINISTRATIVO
                      if (accessMode == LoginAccessMode.administrative) ...[
                        if (isMultiTenantOwner) ...[
                          const SizedBox(height: 12),
                          Text(
                            context.tr('Sedes disponibles (selección rápida):'),
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black54),
                          ),
                          const SizedBox(height: 8),
                          _tenantCard(
                            title: 'FinoCode',
                            subtitle: context.tr('Sede Principal / Documental'),
                            icon: Icons.business,
                            id: '20000000-0000-0000-0000-000000000001',
                          ),
                          const SizedBox(height: 6),
                          _tenantCard(
                            title: 'Clínica Central',
                            subtitle: context.tr('Sector Salud y Pacientes'),
                            icon: Icons.local_hospital,
                            id: '20000000-0000-0000-0000-000000000002',
                          ),
                          const SizedBox(height: 6),
                          _tenantCard(
                            title: context.tr('Plataforma Global'),
                            subtitle: context.tr('Administración NexoDocs'),
                            icon: Icons.language,
                            id: platformTenant,
                          ),
                          const SizedBox(height: 8),
                        ],

                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          key: const Key('tenant'),
                          // ignore: deprecated_member_use
                          value: tenantId,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: context.tr('Organización'),
                            helperText: tenantsLoading ? context.tr('Cargando organizaciones…') : null,
                            errorText: tenantsError,
                            errorMaxLines: 3,
                            suffixIcon: tenantsError != null
                                ? IconButton(icon: const Icon(Icons.refresh), tooltip: context.tr('Reintentar'), onPressed: loadTenants)
                                : null,
                          ),
                          items: [
                            DropdownMenuItem(value: platformTenant, child: Text(context.tr('[ Plataforma / Administración global ]'))),
                            ...tenants.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name, overflow: TextOverflow.ellipsis))),
                            if (tenantId != null && tenantId != platformTenant && !tenants.any((t) => t.id == tenantId))
                              DropdownMenuItem(
                                value: tenantId,
                                child: Text(tenantId == '20000000-0000-0000-0000-000000000001' ? 'FinoCode' : tr('Organización ({id})', {'id': tenantId})),
                              ),
                          ],
                          onChanged: (value) => setState(() => tenantId = value),
                          validator: (value) => value == null ? context.tr('Selecciona tu organización') : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          key: const Key('password'),
                          controller: passwordController,
                          obscureText: !showPassword,
                          autofillHints: const [AutofillHints.password],
                          decoration: InputDecoration(
                            labelText: context.tr('Contraseña'),
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(showPassword ? Icons.visibility_off : Icons.visibility),
                              tooltip: showPassword ? context.tr('Ocultar contraseña') : context.tr('Ver contraseña'),
                              onPressed: () => setState(() => showPassword = !showPassword),
                            ),
                          ),
                          validator: requiredField,
                          onFieldSubmitted: (_) => submitting ? null : submit(),
                        ),
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(error!, key: const Key('login-error'), style: TextStyle(color: Theme.of(context).colorScheme.error)),
                          ),
                        const SizedBox(height: 18),
                        FilledButton(
                          key: const Key('login-submit'),
                          onPressed: submitting ? null : submit,
                          child: Text(submitting ? context.tr('Validando…') : context.tr('Iniciar sesión')),
                        ),
                        TextButton(
                          onPressed: submitting ? null : () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => RecoveryPage(api: widget.authApi, tenants: tenants)),
                          ),
                          child: Text(context.tr('¿Olvidaste tu contraseña?')),
                        ),
                        TextButton(
                          onPressed: submitting ? null : () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => ResetPasswordPage(api: widget.authApi)),
                          ),
                          child: Text(context.tr('Tengo un enlace de recuperación')),
                        ),
                      ],

                      ],

                      const Divider(height: 24),
                      OutlinedButton.icon(
                        key: const Key('public-radicacion-button'),
                        onPressed: submitting ? null : () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => PublicRadicacionPage(
                              client: widget.authApi.client,
                              authApi: widget.authApi,
                              initialEmail: userController.text.trim(),
                              initialTenantId: tenantId,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.search, color: AppTheme.teal),
                        label: Text(context.tr('Consultar Trámite / PQRS (Ciudadanos)')),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.teal,
                          side: const BorderSide(color: AppTheme.teal),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  Widget _biometricCard() => Container(
    key: const Key('biometric-card'),
    padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
    decoration: BoxDecoration(
      color: AppTheme.mint.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppTheme.teal.withValues(alpha: 0.35)),
    ),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: const BoxDecoration(color: AppTheme.teal, shape: BoxShape.circle),
          child: const Icon(Icons.fingerprint, color: Colors.white, size: 36),
        ),
        const SizedBox(height: 10),
        Text(
          context.tr('Desbloquear con huella'),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.ink),
        ),
        const SizedBox(height: 4),
        Text(
          context.tr('Usa la huella guardada en este teléfono'),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            key: const Key('biometrics-login'),
            onPressed: (submitting || biometricFailures >= maxBiometricAttempts) ? null : _unlockWithBiometrics,
            icon: const Icon(Icons.fingerprint),
            label: Text(submitting ? context.tr('Verificando…') : context.tr('Usar huella')),
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
          ),
        ),
        if (widget.lockedMode && error != null) ...[
          const SizedBox(height: 10),
          Text(error!, key: const Key('biometric-error'), textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
        ],
        const SizedBox(height: 4),
        TextButton(
          key: const Key('biometric-use-password'),
          onPressed: submitting ? null : _useFullLogout,
          child: Text(context.tr('Usar contraseña')),
        ),
      ],
    ),
  );

  Widget _orDivider() => Row(
    children: [
      const Expanded(child: Divider()),
      Flexible(
        flex: 3,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            context.tr('o inicia con contraseña'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
        ),
      ),
      const Expanded(child: Divider()),
    ],
  );

  static String? requiredField(String? value) => value == null || value.trim().isEmpty ? tr('Campo obligatorio') : null;
}
