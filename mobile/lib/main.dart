import 'package:flutter/material.dart';

import 'core/api/auth_api.dart';
import 'core/notifications/workflow_notifications.dart';
import 'core/theme/app_theme.dart';
import 'screens/password_page.dart';
import 'screens/auth/login_page.dart';
import 'screens/shell/main_shell_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Registra el canal de avisos y detecta si la app se abrió tocando una notificación.
  await WorkflowNotifications.instance.init();
  runApp(const NexoDocsApp());
}

class NexoDocsApp extends StatefulWidget {
  const NexoDocsApp({super.key, this.authApi});

  final AuthApi? authApi;

  @override
  State<NexoDocsApp> createState() => _NexoDocsAppState();
}

class _NexoDocsAppState extends State<NexoDocsApp> {
  final navigatorKey = GlobalKey<NavigatorState>();
  late final AuthApi api = widget.authApi ?? AuthApi();

  @override
  void initState() {
    super.initState();
    api.client.sessionExpired.addListener(_onSessionExpired);
    api.client.passwordChangeRequired.addListener(_onPasswordChangeRequired);
  }

  @override
  void dispose() {
    api.client.sessionExpired.removeListener(_onSessionExpired);
    api.client.passwordChangeRequired.removeListener(_onPasswordChangeRequired);
    super.dispose();
  }

  /// Sesión vencida sin posibilidad de renovarla: volver al login desde cualquier pantalla.
  void _onSessionExpired() {
    WorkflowNotifications.instance.stop();
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;
    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => LoginPage(authApi: api, notice: 'Tu sesión expiró. Vuelve a iniciar sesión.')),
      (_) => false,
    );
  }

  void _onPasswordChangeRequired() {
    api.mustChangePassword = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final navigator = navigatorKey.currentState;
      if (navigator == null) return;
      navigator.pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) =>
        PasswordPage(api: api, requiredChange: true)), (_) => false);
    });
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    navigatorKey: navigatorKey,
    title: 'NexoDocs',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.lightTheme,
    home: _StartupGate(api: api),
  );
}

/// Restaura el servidor elegido y, si hay sesión guardada, entra directamente.
class _StartupGate extends StatefulWidget {
  const _StartupGate({required this.api});

  final AuthApi api;

  @override
  State<_StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<_StartupGate> {
  late Future<int> _startup = _restore();

  Future<int> _restore() async {
    try {
      await widget.api.client.restoreServerUrl();
      if (!await widget.api.client.hasSession()) return 0;
      await widget.api.restoreProfile();
      return widget.api.mustChangePassword ? 2 : 1;
    } catch (_) {
      return await widget.api.client.hasSession() ? 3 : 0;
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<int>(
    future: _startup,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.teal)));
      }
      return switch (snapshot.data!) {
        1 => MainShellPage(api: widget.api),
        2 => PasswordPage(api: widget.api, requiredChange: true),
        3 => Scaffold(body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('No se pudo verificar la sesión con el servidor.'),
          TextButton(onPressed: () => setState(() => _startup = _restore()), child: const Text('Reintentar')),
          TextButton(onPressed: () async {
            await widget.api.client.clearSession();
            if (mounted) setState(() => _startup = _restore());
          }, child: const Text('Iniciar sesión de nuevo')),
        ]))),
        _ => LoginPage(authApi: widget.api),
      };
    },
  );
}
