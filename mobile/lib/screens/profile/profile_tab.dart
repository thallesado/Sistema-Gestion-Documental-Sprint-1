import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/constants/api_constants.dart';
import '../../core/errors/api_exception.dart';
import '../../core/push/push_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_views.dart';
import '../audit/audit_log_page.dart';
import '../auth/login_page.dart';
import '../../core/i18n/app_language.dart';
import '../password_page.dart';

/// Datos de la cuenta autenticada (GET /auth/me), como "Mi perfil" de la web.
class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  Map<String, dynamic>? user;
  String? error;
  bool loading = true;
  bool biometricAvailable = false;
  bool biometricEnabled = false;
  late bool pushEnabled = widget.api.pushNotificationsEnabled;

  @override
  void initState() {
    super.initState();
    loadProfile();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final available = await widget.api.biometrics.isAvailable();
    final enabled = await widget.api.biometrics.isEnabled();
    if (mounted) {
      setState(() {
        biometricAvailable = available;
        biometricEnabled = enabled;
      });
    }
  }

  /// Switch de notificaciones push: guarda la preferencia en el servidor y, en este teléfono,
  /// registra el token al activarla o lo borra al desactivarla.
  Future<void> _togglePush(bool value) async {
    final messenger = ScaffoldMessenger.of(context);
    final previous = pushEnabled;
    setState(() => pushEnabled = value);
    try {
      await widget.api.setPushNotifications(value);
      final registry = ApiPushTokenRegistry(widget.api.client);
      if (value) {
        await PushService.instance.start(registry);
        if (!PushService.instance.enabled) {
          if (mounted) setState(() => pushEnabled = previous);
          messenger.showSnackBar(SnackBar(content: Text(tr('Las notificaciones push no están disponibles en este dispositivo.'))));
        }
      } else {
        await PushService.instance.unregister(registry: registry);
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => pushEnabled = previous);
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _toggleBiometrics(bool value) async {
    final messenger = ScaffoldMessenger.of(context);
    if (value) {
      final success = await widget.api.biometrics.authenticate(
        reason: tr('Confirma tu identidad para activar el desbloqueo biométrico'),
      );
      if (!success) {
        messenger.showSnackBar(SnackBar(content: Text(tr('No se pudo verificar la identidad biométrica.'))));
        return;
      }
      await widget.api.biometrics.setEnabled(true);
      if (mounted) setState(() => biometricEnabled = true);
      messenger.showSnackBar(SnackBar(content: Text(tr('Desbloqueo biométrico activado.'))));
    } else {
      await widget.api.biometrics.setEnabled(false);
      if (mounted) setState(() => biometricEnabled = false);
      messenger.showSnackBar(SnackBar(content: Text(tr('Desbloqueo biométrico desactivado.'))));
    }
  }

  Future<void> loadProfile() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.me();
      if (mounted) setState(() => user = result);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('Cerrar sesión')),
        content: Text(context.tr('¿Seguro que deseas cerrar tu sesión en NexoDocs?')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.tr('Cancelar'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('Cerrar sesión')),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await widget.api.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => LoginPage(authApi: widget.api)), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading && user == null) return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    if (error != null && user == null) return ErrorStateView(message: error!, onRetry: loadProfile);
    final u = user!;
    final name = '${u['firstName'] ?? ''} ${u['lastName'] ?? ''}'.trim();
    final roles = ((u['roleNames'] as List<dynamic>?) ?? []).cast<String>();
    final initials = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();

    return RefreshIndicator(
      onRefresh: loadProfile,
      color: AppTheme.teal,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: AppTheme.teal,
                child: Text(initials.isEmpty ? 'U' : initials, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(height: 12),
              Text(name.isEmpty ? (u['username'] as String? ?? '') : name, key: const Key('profile-name'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink)),
              const SizedBox(height: 2),
              Text(u['email'] as String? ?? '', style: TextStyle(color: Colors.grey.shade600)),
              const SizedBox(height: 8),
              StatusBadge(
                u['platformAdmin'] == true ? tr('Administración de plataforma') : tr('Organización: {name}', {'name': u['tenantName'] ?? '—'}),
                tone: BadgeTone.brand,
              ),
            ]),
          ),
          const SizedBox(height: 24),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
            child: Column(children: [
              _tile(Icons.badge_outlined, context.tr('Usuario'), u['username']),
              const Divider(height: 1),
              _tile(Icons.admin_panel_settings_outlined, context.tr('Roles'), roles.isEmpty ? '—' : roles.join(', ')),
              const Divider(height: 1),
              _tile(Icons.medical_services_outlined, context.tr('Perfil clínico'), u['staffType'] ?? tr('No asignado')),
              if ((u['phone'] as String?)?.isNotEmpty ?? false) ...[const Divider(height: 1), _tile(Icons.phone_outlined, context.tr('Teléfono'), u['phone'])],
              const Divider(height: 1),
              _tile(Icons.cloud_done_outlined, context.tr('Servidor'), apiBaseUrl),
            ]),
          ),
          const SizedBox(height: 16),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
                  child: Text(context.tr('Seguridad y Dispositivo'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.teal)),
                ),
                SwitchListTile(
                  key: const Key('push-switch'),
                  secondary: const Icon(Icons.notifications_active_outlined, color: AppTheme.teal),
                  title: Text(context.tr('Notificaciones push'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text(context.tr('Avisos de tareas en este dispositivo'), style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  value: pushEnabled,
                  onChanged: _togglePush,
                  activeTrackColor: AppTheme.mint,
                  activeThumbColor: AppTheme.teal,
                ),
                const Divider(height: 1),
                SwitchListTile(
                  key: const Key('biometrics-switch'),
                  secondary: const Icon(Icons.fingerprint, color: AppTheme.teal),
                  title: Text(context.tr('Desbloqueo biométrico'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    biometricAvailable
                        ? tr('Acceso rápido con huella o reconocimiento facial')
                        : tr('Biometría no disponible en este dispositivo'),
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  value: biometricEnabled,
                  onChanged: biometricAvailable ? _toggleBiometrics : null,
                  activeTrackColor: AppTheme.mint,
                  activeThumbColor: AppTheme.teal,
                ),
                const Divider(height: 1),
                ListTile(leading: const Icon(Icons.lock_outline, color: AppTheme.teal),
                  title: Text(context.tr('Cambiar contraseña')), trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<bool>(
                    builder: (_) => PasswordPage(api: widget.api)))),
                if (AuditPermissions.canRead(widget.api.permissions.value)) ...[
                  const Divider(height: 1),
                  ListTile(
                    key: const Key('profile-audit-button'),
                    leading: const Icon(Icons.shield_outlined, color: AppTheme.teal),
                    title: Text(context.tr('Auditoría y Trazabilidad')),
                    subtitle: Text(context.tr('Bitácora inmutable y cadena SHA-256'), style: TextStyle(fontSize: 12)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => AuditLogPage(api: widget.api)),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(context.tr('Idioma'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.teal)),
                  const SizedBox(height: 4),
                  Text(
                    context.tr('Se aplica a toda la app y a los mensajes del servidor.'),
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<AppLanguage>(
                      key: const Key('language-selector'),
                      showSelectedIcon: false,
                      style: SegmentedButton.styleFrom(selectedBackgroundColor: AppTheme.mint, selectedForegroundColor: AppTheme.teal),
                      segments: [
                        for (final language in AppLanguage.values)
                          ButtonSegment(value: language, label: Text(language.nativeName, key: Key('language-${language.name}'))),
                      ],
                      selected: {context.language},
                      onSelectionChanged: (selected) => AppLanguageScope.controllerOf(context).use(selected.first),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (biometricEnabled) ...[
            FilledButton.icon(
              key: const Key('lock-button'),
              onPressed: () => widget.api.lock(),
              icon: const Icon(Icons.lock_outline),
              label: Text(context.tr('Bloquear')),
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.teal,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              key: const Key('logout'),
              onPressed: logout,
              icon: const Icon(Icons.logout, color: Colors.red),
              label: Text(context.tr('Cerrar sesión completamente'), style: const TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: BorderSide(color: Colors.red.shade300),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ] else
            FilledButton.icon(
              key: const Key('logout'),
              onPressed: logout,
              icon: const Icon(Icons.logout),
              label: Text(context.tr('Cerrar sesión')),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade600,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _tile(IconData icon, String title, Object? value) => ListTile(
    leading: Icon(icon, color: AppTheme.teal),
    title: Text(title, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
    subtitle: Text(value?.toString() ?? '—', style: const TextStyle(fontSize: 14, color: AppTheme.ink)),
  );
}
