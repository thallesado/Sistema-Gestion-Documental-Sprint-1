import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api/auth_api.dart';
import 'core/i18n/app_language.dart';
import 'core/notifications/workflow_notifications.dart';
import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'screens/password_page.dart';
import 'screens/auth/app_lock_overlay.dart';
import 'screens/auth/login_page.dart';
import 'screens/shell/main_shell_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Registra el canal de avisos y detecta si la app se abrió tocando una notificación.
  await WorkflowNotifications.instance.init();
  // Firebase para avisos push. Sin google-services.json no hace nada y la app sigue por sondeo.
  await PushService.instance.prepare();
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
    api.client.passwordChangeRequired.addListener(_onPasswordChangeRequired);
  }

  @override
  void dispose() {
    api.client.sessionExpired.removeListener(_onSessionExpired);
    language.removeListener(_onLanguageChanged);
    api.client.passwordChangeRequired.removeListener(_onPasswordChangeRequired);
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
        builder: (context, child) => AppLockOverlay(
          api: api,
          child: child!,
          onFullLogout: () => navigatorKey.currentState?.pushAndRemoveUntil(
            MaterialPageRoute<void>(builder: (_) => LoginPage(authApi: api)),
            (_) => false,
          ),
        ),
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
  late Future<int> _startup = _restore();

  Future<int> _restore() async {
    try {
      await widget.api.client.restoreServerUrl();
      if (!await widget.api.client.hasSession()) return 0;
      if (await widget.api.biometrics.isEnabled()) {
        // Sesión guardada + huella activa: la capa de bloqueo pide la huella antes de mostrar contenido.
        widget.api.locked.value = true;
        return 4;
      }
      await widget.api.restoreProfile();
      return widget.api.mustChangePassword ? 2 : 1;
    } catch (_) {
      return await widget.api.client.hasSession() ? 3 : 0;
    }
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(
    valueListenable: widget.api.locked,
    builder: (context, isLocked, _) => FutureBuilder<int>(
      future: _startup,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.teal)));
        }
        return switch (snapshot.data!) {
          1 => MainShellPage(api: widget.api),
          2 => PasswordPage(api: widget.api, requiredChange: true),
          // Bloqueado: no se muestra contenido detrás de la capa de huella.
          4 => isLocked
              ? const Scaffold(body: SizedBox.shrink())
              : widget.api.mustChangePassword
                  ? PasswordPage(api: widget.api, requiredChange: true)
                  : MainShellPage(api: widget.api),
          3 => Scaffold(body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(context.tr('No se pudo verificar la sesión con el servidor.')),
            TextButton(onPressed: () => setState(() => _startup = _restore()), child: Text(context.tr('Reintentar'))),
            TextButton(onPressed: () async {
              await widget.api.client.clearSession();
              if (mounted) setState(() => _startup = _restore());
            }, child: Text(context.tr('Iniciar sesión de nuevo'))),
          ]))),
          _ => LoginPage(authApi: widget.api),
        };
      },
    ),
  );
}
