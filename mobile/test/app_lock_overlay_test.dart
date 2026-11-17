import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/biometric_service.dart';
import 'package:nexodocs_mobile/screens/auth/app_lock_overlay.dart';

class _FakeBiometrics extends BiometricService {
  _FakeBiometrics({required this.enabled, this.result = true});

  final bool enabled;
  final bool result;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<bool> authenticate({String? reason = ''}) async => result;
}

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});

MockClient _client() => MockClient((request) async {
      final path = request.url.path.replaceFirst('/api/v1', '');
      if (path == '/tenants/public') return _json([]);
      if (path == '/auth/me') return _json({'firstName': 'Laura', 'permissions': ['document:read']});
      if (path == '/auth/logout') return _json({});
      return _json({'message': 'no simulada'}, 404);
    });

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({
        ApiClient.accessTokenKey: 'access',
        ApiClient.refreshTokenKey: 'refresh',
      }));

  testWidgets('bloquear con una pantalla apilada muestra el login con huella y desbloquear vuelve a la misma pantalla', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final api = AuthApi(client: _client(), biometrics: _FakeBiometrics(enabled: true, result: true));

    await tester.pumpWidget(MaterialApp(
      builder: (context, child) => AppLockOverlay(api: api, child: child!),
      home: Scaffold(body: Builder(builder: (context) => Center(
        child: Text('PANTALLA ABIERTA', key: const Key('contenido'))))),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('biometric-card')), findsNothing);

    api.lock();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('biometric-card')), findsOneWidget, reason: 'Bloquear debe mostrar la tarjeta de huella');
    expect(find.text('Desbloquear con huella'), findsOneWidget);

    await tester.tap(find.byKey(const Key('biometrics-login')));
    await tester.pumpAndSettle();
    expect(api.locked.value, isFalse);
    expect(find.byKey(const Key('biometric-card')), findsNothing);
    expect(find.byKey(const Key('contenido')), findsOneWidget, reason: 'vuelve a la misma pantalla abierta');
  });

  testWidgets('con huella desactivada no hay capa de bloqueo', (tester) async {
    final api = AuthApi(client: _client(), biometrics: _FakeBiometrics(enabled: false));
    await tester.pumpWidget(MaterialApp(
      builder: (context, child) => AppLockOverlay(api: api, child: child!),
      home: const Scaffold(body: Text('INICIO')),
    ));
    await tester.pumpAndSettle();
    expect(find.text('INICIO'), findsOneWidget);
    expect(find.byKey(const Key('biometric-card')), findsNothing);
  });
}
