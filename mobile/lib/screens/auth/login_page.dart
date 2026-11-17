import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../features/auth/presentation/widgets/server_config_dialog.dart';
import '../../core/api/auth_api.dart';
import '../../core/constants/api_constants.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../shell/main_shell_page.dart';
import '../../core/i18n/app_language.dart';

/// Valor del selector para el administrador de plataforma (sin organización), como en la web.
const platformTenant = '';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.authApi, this.notice});

  final AuthApi authApi;

  /// Aviso informativo, p. ej. cuando la sesión expiró.
  final String? notice;

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
  String? error;

  @override
  void initState() {
    super.initState();
    loadTenants();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final enabled = await widget.authApi.biometrics.isEnabled();
    final hasSession = await widget.authApi.client.hasSession();
    if (mounted) {
      setState(() => biometricEnabled = enabled && hasSession);
    }
  }

  Future<void> _unlockWithBiometrics() async {
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      final authenticated = await widget.authApi.biometrics.authenticate(
        reason: tr('Usa tu biometría para acceder a NexoDocs'),
      );
      if (!authenticated) {
        if (mounted) setState(() => submitting = false);
        return;
      }
      await widget.authApi.loadPermissions();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => MainShellPage(api: widget.authApi)),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  void dispose() {
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
        tenants = result;
        if (tenantId != null && tenantId != platformTenant && !result.any((t) => t.id == tenantId)) tenantId = null;
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => tenantsError = tr('No se pudo cargar la lista de organizaciones. {detail}', {'detail': exception.message}));
    } finally {
      if (mounted) setState(() => tenantsLoading = false);
    }
  }

  void showServerDialog() {
    showDialog<void>(
      context: context,
      builder: (_) => ServerConfigDialog(
        currentUrl: apiBaseUrl,
        onSave: (url) async {
          await widget.authApi.client.saveServerUrl(url);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Servidor: {url}', {'url': apiBaseUrl}))));
          loadTenants();
        },
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
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => MainShellPage(api: widget.authApi)));
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
    error = null;
  });

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
                      Text(context.tr('Inicia sesión en tu organización'), textAlign: TextAlign.center),
                      if (widget.notice != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: const Color(0xfffef3c7), borderRadius: BorderRadius.circular(8)),
                          child: Text(widget.notice!, key: const Key('login-notice'), style: const TextStyle(fontSize: 13)),
                        ),
                      ],
                      if (kDebugMode) ...[
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          alignment: WrapAlignment.center,
                          children: [
                            ActionChip(
                              avatar: const Icon(Icons.business, size: 14),
                              label: Text(context.tr('Demo: Laura (admin)'), style: TextStyle(fontSize: 12)),
                              onPressed: () => fillDemo('laura@acme.com', '20000000-0000-0000-0000-000000000001'),
                            ),
                            ActionChip(
                              avatar: const Icon(Icons.shield_outlined, size: 14),
                              label: Text(context.tr('Demo: Carlos (plataforma)'), style: TextStyle(fontSize: 12)),
                              onPressed: () => fillDemo('carlos@nexodocs.com', platformTenant),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        key: const Key('tenant'),
                        initialValue: tenantId,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: context.tr('Organización'),
                          helperText: tenantsLoading ? tr('Cargando organizaciones…') : null,
                          errorText: tenantsError,
                          errorMaxLines: 3,
                          suffixIcon: tenantsError != null
                              ? IconButton(icon: const Icon(Icons.refresh), tooltip: context.tr('Reintentar'), onPressed: loadTenants)
                              : null,
                        ),
                        items: [
                          DropdownMenuItem(value: platformTenant, child: Text(context.tr('[ Plataforma / Administración global ]'))),
                          ...tenants.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name, overflow: TextOverflow.ellipsis))),
                        ],
                        onChanged: tenantsLoading ? null : (value) => setState(() => tenantId = value),
                        validator: (value) => value == null ? tr('Selecciona tu organización') : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        key: const Key('username'),
                        controller: userController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
                        decoration: InputDecoration(labelText: context.tr('Correo o usuario')),
                        validator: requiredField,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        key: const Key('password'),
                        controller: passwordController,
                        obscureText: !showPassword,
                        autofillHints: const [AutofillHints.password],
                        decoration: InputDecoration(
                          labelText: context.tr('Contraseña'),
                          suffixIcon: IconButton(
                            icon: Icon(showPassword ? Icons.visibility_off : Icons.visibility),
                            tooltip: showPassword ? tr('Ocultar contraseña') : tr('Ver contraseña'),
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
                        child: Text(submitting ? tr('Validando…') : tr('Iniciar sesión')),
                      ),
                      if (biometricEnabled) ...[
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          key: const Key('biometrics-login'),
                          onPressed: submitting ? null : _unlockWithBiometrics,
                          icon: const Icon(Icons.fingerprint, color: AppTheme.teal),
                          label: Text(context.tr('Desbloquear con biometría')),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.teal,
                            side: const BorderSide(color: AppTheme.teal),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ],
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

  static String? requiredField(String? value) => value == null || value.trim().isEmpty ? tr('Campo obligatorio') : null;
}
