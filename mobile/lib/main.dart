import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api/auth_api.dart';
import 'core/i18n/app_language.dart';
import 'core/notifications/workflow_notifications.dart';
import 'core/theme/app_theme.dart';
import 'screens/auth/login_page.dart';
import 'screens/shell/main_shell_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Registra el canal de avisos y detecta si la app se abrió tocando una notificación.
  await WorkflowNotifications.instance.init();
  // Idioma elegido en el perfil (español por defecto, como la web).
  await AppLanguageController.instance.load();
  runApp(const NexoDocsApp());
}

class NexoDocsApp extends StatefulWidget {
  const NexoDocsApp({super.key, this.authApi, this.language});

  final AuthApi? authApi;

  /// Idioma de la interfaz; `null` usa [AppLanguageController.instance].
  final AppLanguageController? language;

  @override
  State<NexoDocsApp> createState() => _NexoDocsAppState();
}

class _NexoDocsAppState extends State<NexoDocsApp> {
  final navigatorKey = GlobalKey<NavigatorState>();
  late final AuthApi api = widget.authApi ?? AuthApi();
  late final AppLanguageController language = widget.language ?? AppLanguageController.instance;

  @override
  void initState() {
    super.initState();
    api.client.sessionExpired.addListener(_onSessionExpired);
    language.addListener(_onLanguageChanged);
  }

  @override
  void dispose() {
    api.client.sessionExpired.removeListener(_onSessionExpired);
    language.removeListener(_onLanguageChanged);
    super.dispose();
  }

  /// Textos calculados fuera de `build` (etiquetas, mensajes) también deben cambiar de idioma:
  /// se marca todo el árbol para reconstruirse, incluidas las pantallas apiladas.
  void _onLanguageChanged() {
    void rebuild(Element element) {
      element.markNeedsBuild();
      element.visitChildren(rebuild);
    }

    WidgetsBinding.instance.rootElement?.visitChildren(rebuild);
  }

  /// Sesión vencida sin posibilidad de renovarla: volver al login desde cualquier pantalla.
  void _onSessionExpired() {
    WorkflowNotifications.instance.stop();
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;
    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => LoginPage(authApi: api, notice: tr('Tu sesión expiró. Vuelve a iniciar sesión.'))),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) => AppLanguageScope(
    controller: language,
    child: ValueListenableBuilder<AppLanguage>(
      valueListenable: language,
      builder: (context, current, _) => MaterialApp(
        navigatorKey: navigatorKey,
        title: 'NexoDocs',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        locale: current.locale,
        supportedLocales: [for (final value in AppLanguage.values) value.locale],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: _StartupGate(api: api),
      ),
    ),
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
