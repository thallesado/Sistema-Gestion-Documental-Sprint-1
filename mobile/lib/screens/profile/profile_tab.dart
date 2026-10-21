import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/constants/api_constants.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_views.dart';
import '../auth/login_page.dart';

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

  @override
  void initState() {
    super.initState();
    loadProfile();
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
        title: const Text('Cerrar sesión'),
        content: const Text('¿Seguro que deseas cerrar tu sesión en NexoDocs?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cerrar sesión'),
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
                u['platformAdmin'] == true ? 'Administración de plataforma' : 'Organización: ${u['tenantName'] ?? '—'}',
                tone: BadgeTone.brand,
              ),
            ]),
          ),
          const SizedBox(height: 24),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
            child: Column(children: [
              _tile(Icons.badge_outlined, 'Usuario', u['username']),
              const Divider(height: 1),
              _tile(Icons.admin_panel_settings_outlined, 'Roles', roles.isEmpty ? '—' : roles.join(', ')),
              const Divider(height: 1),
              _tile(Icons.medical_services_outlined, 'Perfil clínico', u['staffType'] ?? 'No asignado'),
              if ((u['phone'] as String?)?.isNotEmpty ?? false) ...[const Divider(height: 1), _tile(Icons.phone_outlined, 'Teléfono', u['phone'])],
              const Divider(height: 1),
              _tile(Icons.cloud_done_outlined, 'Servidor', apiBaseUrl),
            ]),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            key: const Key('logout'),
            onPressed: logout,
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
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
