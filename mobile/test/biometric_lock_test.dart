import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/biometric_service.dart';
import 'package:nexodocs_mobile/screens/auth/login_page.dart';

class _FakeBiometrics extends BiometricService {
  _FakeBiometrics({required this.enabled, this.result = true});

  bool enabled;
  bool result;
  int authCalls = 0;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<void> setEnabled(bool value) async => enabled = value;

  @override
  Future<bool> authenticate({String? reason = ''}) async {
    authCalls++;
    return result;
  }
}

class _Server {
  final requests = <http.Request>[];

  late final client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/api/v1', '');
    if (path == '/tenants/public') return _json([]);
    if (path == '/auth/me') {
      return _json({'firstName': 'Laura', 'lastName': 'Martínez', 'permissions': ['document:read']});
    }
    if (path == '/auth/logout') return _json({});
    return _json({'message': 'Ruta no simulada: $path'}, 404);
  });

  static http.Response _json(Object body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});

  Iterable<http.Request> called(String method, String path) =>
      requests.where((r) => r.method == method && r.url.path.replaceFirst('/api/v1', '') == path);
}

void _sessionSaved() => FlutterSecureStorage.setMockInitialValues({
      ApiClient.accessTokenKey: 'access',
      ApiClient.refreshTokenKey: 'refresh',
    });

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  Future<({_Server server, _FakeBiometrics biometrics, AuthApi api, List<int> unlocks})> pumpLocked(
    WidgetTester tester, {
    required bool enabled,
    bool hasSession = true,
    bool result = true,
  }) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    if (hasSession) _sessionSaved();
    final server = _Server();
    final biometrics = _FakeBiometrics(enabled: enabled, result: result);
    final api = AuthApi(client: server.client, biometrics: biometrics);
    final unlocks = <int>[];
    await tester.pumpWidget(MaterialApp(
      home: LoginPage(authApi: api, lockedMode: true, onUnlocked: () => unlocks.add(1)),
    ));
    await tester.pumpAndSettle();
    return (server: server, biometrics: biometrics, api: api, unlocks: unlocks);
  }

  testWidgets('bloquear no llama a /auth/logout ni borra los tokens', (tester) async {
    _sessionSaved();
    final server = _Server();
    final api = AuthApi(client: server.client, biometrics: _FakeBiometrics(enabled: true));
    api.lock();
    expect(api.locked.value, isTrue);
    expect(server.called('POST', '/auth/logout'), isEmpty);
    expect(await api.client.hasSession(), isTrue);
  });

  testWidgets('con huella activa y sesión guardada el login muestra la tarjeta y oculta el formulario', (tester) async {
    await pumpLocked(tester, enabled: true);
    expect(find.byKey(const Key('biometric-card')), findsOneWidget);
    expect(find.text('Desbloquear con huella'), findsOneWidget);
    expect(find.byKey(const Key('biometric-use-password')), findsOneWidget);
    expect(find.byKey(const Key('password')), findsNothing);
  });

  testWidgets('huella verificada restaura la sesión y avisa que la app se desbloqueó', (tester) async {
    final r = await pumpLocked(tester, enabled: true, result: true);
    await tester.tap(find.byKey(const Key('biometrics-login')));
    await tester.pumpAndSettle();
    expect(r.biometrics.authCalls, 1);
    expect(r.server.called('GET', '/auth/me'), isNotEmpty);
    expect(r.unlocks, [1]);
  });

  testWidgets('huella cancelada se queda en el login con mensaje', (tester) async {
    final r = await pumpLocked(tester, enabled: true, result: false);
    await tester.tap(find.byKey(const Key('biometrics-login')));
    await tester.pumpAndSettle();
    expect(r.unlocks, isEmpty);
    expect(find.byKey(const Key('biometric-card')), findsOneWidget);
    expect(find.text('La verificación con huella fue cancelada o falló.'), findsOneWidget);
  });

  testWidgets('tras 3 fallos de huella se deshabilita y aparece el formulario de contraseña', (tester) async {
    final r = await pumpLocked(tester, enabled: true, result: false);
    for (var i = 0; i < 3; i++) {
      await tester.tap(find.byKey(const Key('biometrics-login')));
      await tester.pumpAndSettle();
    }
    expect(r.biometrics.authCalls, 3);
    expect(find.text('Demasiados intentos con la huella. Ingresa tu contraseña.'), findsWidgets);
    expect(find.byKey(const Key('password')), findsOneWidget);
    final button = tester.widget<FilledButton>(find.byKey(const Key('biometrics-login')));
    expect(button.onPressed, isNull);
  });

  testWidgets('usar contraseña hace logout completo, borra tokens y desactiva la huella', (tester) async {
    final r = await pumpLocked(tester, enabled: true);
    await tester.tap(find.byKey(const Key('biometric-use-password')));
    await tester.pumpAndSettle();
    expect(r.server.called('POST', '/auth/logout'), isNotEmpty);
    expect(await r.api.client.hasSession(), isFalse);
    expect(await r.biometrics.isEnabled(), isFalse);
    expect(find.byKey(const Key('biometric-card')), findsNothing);
    expect(find.byKey(const Key('password')), findsOneWidget);
  });

  testWidgets('sin sesión guardada no se ofrece la huella', (tester) async {
    await pumpLocked(tester, enabled: true, hasSession: false);
    expect(find.byKey(const Key('biometric-card')), findsNothing);
    expect(find.byKey(const Key('password')), findsOneWidget);
  });

  test('con huella desactivada el cierre de sesión sigue igual: /auth/logout y tokens borrados', () async {
    _sessionSaved();
    final server = _Server();
    final api = AuthApi(client: server.client, biometrics: _FakeBiometrics(enabled: false));
    await api.logout();
    expect(server.called('POST', '/auth/logout'), isNotEmpty);
    expect(await api.client.hasSession(), isFalse);
    expect(api.locked.value, isFalse);
  });
}
