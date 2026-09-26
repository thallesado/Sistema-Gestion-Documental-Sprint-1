import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../auth/login_page.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  String tenantId = '';
  String userEmail = '';

  @override
  void initState() {
    super.initState();
    loadProfile();
  }

  Future<void> loadProfile() async {
    final tId = await widget.api.getTenantId() ?? 'FinoCode';
    final email = await widget.api.getUserEmail() ?? 'laura@acme.com';
    if (mounted) {
      setState(() {
        tenantId = tId;
        userEmail = email;
      });
    }
  }

  Future<void> logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Estás seguro de que deseas cerrar tu sesión en NexoDocs?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
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

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => LoginPage(authApi: widget.api),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: Column(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: const Color(0xff087f7b),
                child: Text(
                  userEmail.isNotEmpty ? userEmail[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                userEmail,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xff1f2937)),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xffd4ece7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Tenant: $tenantId',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xff087f7b)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.security, color: Color(0xff087f7b)),
                title: const Text('Seguridad y token JWT'),
                subtitle: const Text('Sesión cifrada con SecureStorage'),
                trailing: const Icon(Icons.check_circle, color: Color(0xff10b981), size: 18),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.cloud_done_outlined, color: Color(0xff087f7b)),
                title: const Text('Conexión con backend'),
                subtitle: const Text('Spring Boot API REST v1'),
                trailing: const Icon(Icons.chevron_right, size: 18),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.info_outline, color: Color(0xff087f7b)),
                title: const Text('Versión de NexoDocs'),
                subtitle: const Text('1.0.0 (Sprint 1 - Mobile)'),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        FilledButton.icon(
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
    );
  }
}
