import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/auth/login_page.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  final mockTenantsResponse = [
    {'id': '20000000-0000-0000-0000-000000000001', 'name': 'FinoCode'},
    {'id': '20000000-0000-0000-0000-000000000002', 'name': 'Clínica Central'},
  ];

  late MockClient mockClient;
  late AuthApi authApi;

  setUp(() {
    mockClient = MockClient((request) async {
      if (request.url.path.endsWith('/tenants/public')) {
        return http.Response.bytes(
          utf8.encode(jsonEncode(mockTenantsResponse)),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{"message":"not found"}', 404);
    });
    authApi = AuthApi(client: mockClient);
  });

  Widget createLoginHost() => MaterialApp(
        theme: AppTheme.lightTheme,
        home: LoginPage(authApi: authApi),
      );

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
  }

  testWidgets('detecta inteligentemente correo ciudadano y cambia a modo Portal Ciudadano', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(createLoginHost());
    await tester.pumpAndSettle();

    // Escribir un correo personal externo (Gmail)
    await tester.enterText(find.byKey(const Key('username')), 'elkin.cliente@gmail.com');
    await tester.pumpAndSettle();

    // Debe mostrar badge de rol ciudadano sin emojis
    expect(find.text('Usuario Ciudadano / Cliente'), findsOneWidget);

    // Debe mostrar tarjeta de bienvenida ciudadana con botón de entrada directa
    expect(find.text('Portal Ciudadano y Radicación'), findsOneWidget);
    expect(find.byKey(const Key('citizen-portal-submit')), findsOneWidget);

    // Puede conmutar al modo administrativo si es funcionario
    await tapVisible(tester, find.text('Administrativo'));
    await tester.pumpAndSettle();

    // Vuelve a mostrar campos corporativos
    expect(find.byKey(const Key('password')), findsOneWidget);
    expect(find.byKey(const Key('login-submit')), findsOneWidget);
  });

  testWidgets('detecta dueña Laura, muestra sus sedes táctiles y permite conmutar modo', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(createLoginHost());
    await tester.pumpAndSettle();

    // Escribir email de la dueña Laura
    await tester.enterText(find.byKey(const Key('username')), 'laura@acme.com');
    await tester.pumpAndSettle();

    // Debe mostrar badge de Dueña / Admin Multitenant sin emojis
    expect(find.text('Dueña / Administradora General'), findsOneWidget);

    // Debe mostrar tarjetas de sedes disponibles
    expect(find.text('Sedes disponibles (selección rápida):'), findsOneWidget);
    expect(find.text('FinoCode'), findsWidgets);
    expect(find.text('Clínica Central'), findsWidgets);

    // Seleccionar Clínica Central mediante toque directo en la tarjeta
    await tapVisible(tester, find.text('Clínica Central').first);
    await tester.pumpAndSettle();

    // Puede optar por entrar en modo ciudadano para radicar trámite propio
    await tapVisible(tester, find.text('Ciudadano'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('citizen-portal-submit')), findsOneWidget);
  });

  testWidgets('detecta personal de salud y supervisor por correo', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(createLoginHost());
    await tester.pumpAndSettle();

    // Escribir correo de salud
    await tester.enterText(find.byKey(const Key('username')), 'maria@clinicacentral.test');
    await tester.pumpAndSettle();

    expect(find.text('Sector Salud / Personal Clínico'), findsOneWidget);

    // Escribir correo de supervisor
    await tester.enterText(find.byKey(const Key('username')), 'supervisor@acme.com');
    await tester.pumpAndSettle();

    expect(find.text('Supervisor / Aprobador de Tareas'), findsOneWidget);
  });

  testWidgets('sin pistas de demostración (release) no adivina el rol ni elige organización', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: LoginPage(authApi: authApi, demoHints: false),
    ));
    await tester.pumpAndSettle();

    // "mariana" contiene "maria": con las pistas activas preseleccionaría Clínica Central.
    await tester.enterText(find.byKey(const Key('username')), 'mariana@empresa.com');
    await tester.pumpAndSettle();
    expect(find.text('Sector Salud / Personal Clínico'), findsNothing);
    // El selector cerrado solo muestra la organización elegida: no debe haber ninguna.
    expect(find.descendant(of: find.byKey(const Key('tenant')), matching: find.text('Clínica Central')), findsNothing);

    // Un correo personal tampoco cambia solo al portal ciudadano.
    await tester.enterText(find.byKey(const Key('username')), 'persona@gmail.com');
    await tester.pumpAndSettle();
    expect(find.text('Portal Ciudadano y Radicación'), findsNothing);
  });
}
