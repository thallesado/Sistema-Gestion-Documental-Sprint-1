import 'package:flutter/material.dart';

import 'core/api/auth_api.dart';
import 'core/theme/app_theme.dart';
import 'screens/auth/login_page.dart';
import 'screens/shell/main_shell_page.dart';

void main() => runApp(const NexoDocsApp());

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
  }

  @override
  void dispose() {
    api.client.sessionExpired.removeListener(_onSessionExpired);
    super.dispose();
  }

  /// Sesión vencida sin posibilidad de renovarla: volver al login desde cualquier pantalla.
  void _onSessionExpired() {
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;
    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => LoginPage(authApi: api, notice: 'Tu sesión expiró. Vuelve a iniciar sesión.')),
      (_) => false,
    );
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
  late final Future<bool> _hasSession = _restore();

  Future<bool> _restore() async {
    try {
      await widget.api.client.restoreServerUrl();
      return await widget.api.client.hasSession();
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<bool>(
    future: _hasSession,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.teal)));
      }
      return snapshot.data! ? MainShellPage(api: widget.api) : LoginPage(authApi: widget.api);
    },
  );
}
