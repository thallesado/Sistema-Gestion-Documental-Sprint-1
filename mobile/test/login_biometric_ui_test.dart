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
  _FakeBiometrics({required this.enabled});

  final bool enabled;
  int authCalls = 0;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<bool> authenticate({String? reason = ''}) async {
    authCalls++;
    return false;
  }
}

Future<_FakeBiometrics> _pump(WidgetTester tester, {required bool enabled, bool session = true}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  FlutterSecureStorage.setMockInitialValues(session ? {ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'} : {});
  final biometrics = _FakeBiometrics(enabled: enabled);
  final client = MockClient((request) async {
    if (request.url.path.endsWith('/tenants/public')) {
      return http.Response(jsonEncode([]), 200, headers: {'content-type': 'application/json'});
    }
    return http.Response('{"message":"no simulada"}', 404);
  });
  final authApi = AuthApi(client: client, biometrics: biometrics);
  await tester.pumpWidget(MaterialApp(home: LoginPage(authApi: authApi)));
  await tester.pumpAndSettle();
  return biometrics;
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('con huella guardada muestra la tarjeta de huella, el separador y el formulario de contraseña', (tester) async {
    await _pump(tester, enabled: true);
    expect(find.byKey(const Key('biometric-card')), findsOneWidget);
    expect(find.text('Desbloquear con huella'), findsOneWidget);
    expect(find.text('o inicia con contraseña'), findsOneWidget);
    expect(find.byKey(const Key('password')), findsOneWidget);
    expect(find.byKey(const Key('login-submit')), findsOneWidget);
  });

  testWidgets('sin huella configurada solo muestra el formulario de contraseña', (tester) async {
    await _pump(tester, enabled: false);
    expect(find.byKey(const Key('biometric-card')), findsNothing);
    expect(find.text('o inicia con contraseña'), findsNothing);
    expect(find.byKey(const Key('password')), findsOneWidget);
    expect(find.byKey(const Key('login-submit')), findsOneWidget);
  });

  testWidgets('la huella sin sesión guardada no se ofrece', (tester) async {
    await _pump(tester, enabled: true, session: false);
    expect(find.byKey(const Key('biometric-card')), findsNothing);
  });

  testWidgets('el botón Usar huella pide la verificación biométrica', (tester) async {
    final biometrics = await _pump(tester, enabled: true);
    await tester.tap(find.byKey(const Key('biometrics-login')));
    await tester.pumpAndSettle();
    expect(biometrics.authCalls, 1);
  });
}
