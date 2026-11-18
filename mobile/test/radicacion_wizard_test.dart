import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/models/radicacion_model.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/documents/upload_version_sheet.dart';
import 'package:nexodocs_mobile/screens/expedients/expedients_tab.dart';
import 'package:nexodocs_mobile/screens/expedients/radicacion_wizard_sheet.dart';

class FakeServer {
  FakeServer(this.routes);

  final Map<String, http.Response Function(http.Request request)> routes;
  final requests = <http.Request>[];

  late final client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/api/v1', '');
    final handler = routes['${request.method} $path'];
    return handler?.call(request) ?? http.Response('{"message":"Ruta no simulada: $path"}', 404);
  });

  static http.Response json(Object body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});
}

class FakePathProviderPlatform extends Fake with MockPlatformInterfaceMixin implements PathProviderPlatform {
  @override
  Future<String?> getApplicationDocumentsPath() async => Directory.systemTemp.path;
}

AuthApi apiWith(FakeServer server, List<String> permissions) =>
    AuthApi(client: server.client)..permissions.value = UserPermissions(permissions.toSet());

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    PathProviderPlatform.instance = FakePathProviderPlatform();
    FlutterSecureStorage.setMockInitialValues({
      ApiClient.accessTokenKey: 'test-token',
      ApiClient.refreshTokenKey: 'test-refresh',
    });
  });

  group('Buzón de Radicación Digital Directa (PQRS / Solicitudes Ciudadanas)', () {
    testWidgets('Wizard guiado permite radicar solicitud con soporte y genera código único', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      var expedientCreated = false;
      var documentCreated = false;
      var versionUploaded = false;

      final server = FakeServer({
        'GET /expedient-types': (_) => FakeServer.json({
              'content': [
                {'id': 'type-pqrs', 'code': 'PQRS', 'name': 'Peticiones, Quejas y Reclamos'},
                {'id': 'type-tramite', 'code': 'TRAM', 'name': 'Trámites Administrativos'},
              ],
              'totalElements': 2,
            }),
        'GET /document-types': (_) => FakeServer.json({
              'content': [
                {'id': 'dt-soporte', 'code': 'SOP', 'name': 'Documento Soporte'},
              ],
              'totalElements': 1,
            }),
        'POST /expedients': (req) {
          expedientCreated = true;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['code'], startsWith('RAD-'));
          expect(body['name'], startsWith('Queja:'));
          expect(body['expedientTypeId'], 'type-pqrs');

          final meta = body['metadata'] as Map<String, dynamic>;
          expect(meta['pqrsType'], 'QUEJA');
          expect(meta['citizen']['name'], 'Juan Ciudadano');
          expect(meta['citizen']['docNumber'], '1020304050');

          return FakeServer.json({
            'id': 'exp-new-rad',
            'code': body['code'],
            'name': body['name'],
            'status': 'ACTIVE',
            'createdAt': '2026-11-17T10:00:00Z',
            'updatedAt': '2026-11-17T10:00:00Z',
          }, 201);
        },
        'POST /documents': (req) {
          documentCreated = true;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['name'], startsWith('Soporte_QUEJA_'));
          return FakeServer.json({
            'id': 'doc-new-soporte',
            'name': body['name'],
            'code': body['code'],
            'status': 'DRAFT',
            'currentVersion': 1,
          }, 201);
        },
        'GET /documents/doc-new-soporte': (_) => http.Response('{"id":"doc-new-soporte"}', 200, headers: {'etag': '"v1-etag"'}),
        'POST /documents/doc-new-soporte/versions': (_) {
          versionUploaded = true;
          return FakeServer.json({
            'id': 'ver-new',
            'versionNumber': 1,
            'fileName': 'evidencia_reclamo.pdf',
            'fileSizeBytes': 2048,
          }, 201);
        },
      });

      final api = apiWith(server, ['expedient:read', 'expedient:create', 'document:create', 'document:update']);

      final fakeFile = File('${Directory.systemTemp.path}/evidencia_reclamo.pdf')..writeAsStringSync('dummy content');
      Future<PickedUpload?> fakePicker(UploadOrigin origin) async => PickedUpload(
            path: fakeFile.path,
            name: 'evidencia_reclamo.pdf',
            sizeBytes: fakeFile.lengthSync(),
            isImage: false,
          );

      RadicacionResultModel? result;

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (ctx) => ElevatedButton(
              onPressed: () async {
                result = await showRadicacionWizardSheet(ctx, api, picker: fakePicker);
              },
              child: const Text('Abrir Radicación'),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Abrir el wizard
      await tester.tap(find.text('Abrir Radicación'));
      await tester.pumpAndSettle();

      // --- PASO 1: Tipo y Datos del Solicitante ---
      expect(find.text('Tipo de radicación / PQRS'), findsOneWidget);

      // Seleccionar Queja
      await tester.tap(find.byKey(const Key('radicacion-type-QUEJA')));
      await tester.pumpAndSettle();

      // Llenar campos del solicitante
      await tester.enterText(find.byKey(const Key('radicacion-citizen-name')), 'Juan Ciudadano');
      await tester.enterText(find.byKey(const Key('radicacion-citizen-doc')), '1020304050');
      await tester.enterText(find.byKey(const Key('radicacion-citizen-email')), 'juan@ciudadano.org');
      await tester.enterText(find.byKey(const Key('radicacion-citizen-phone')), '3001234567');
      await tester.pumpAndSettle();

      // Siguiente paso
      await tester.tap(find.byKey(const Key('radicacion-next-button')));
      await tester.pumpAndSettle();

      // --- PASO 2: Detalle de la Solicitud ---
      expect(find.text('Detalle de la solicitud'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('radicacion-title-input')), 'Demora injustificada en trámite de catastro');
      await tester.enterText(find.byKey(const Key('radicacion-description-input')), 'Llevo más de 30 días hábiles esperando respuesta a mi solicitud.');
      await tester.pumpAndSettle();

      // Siguiente paso
      await tester.tap(find.byKey(const Key('radicacion-next-button')));
      await tester.pumpAndSettle();

      // --- PASO 3: Soporte y Confirmación ---
      expect(find.text('Documento de soporte (Opcional)'), findsOneWidget);
      expect(find.text('Resumen de radicación'), findsOneWidget);
      expect(find.text('Juan Ciudadano (CC 1020304050)'), findsOneWidget);

      // Adjuntar archivo con fake picker
      final pickDocBtn = find.byKey(const Key('radicacion-pick-file'));
      await tester.tap(pickDocBtn);
      await tester.pumpAndSettle();

      expect(find.text('evidencia_reclamo.pdf'), findsWidgets);

      // Radicar la solicitud
      final submitBtn = find.byKey(const Key('radicacion-submit-button'));
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(expedientCreated, isTrue);
      expect(documentCreated, isTrue);
      expect(versionUploaded, isTrue);
      expect(result, isNotNull);
      expect(result!.expedientCode, startsWith('RAD-'));
    });

    testWidgets('ExpedientsTab abre el wizard desde el botón flotante y muestra diálogo de comprobante', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final server = FakeServer({
        'GET /expedients': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /expedient-types': (_) => FakeServer.json({
              'content': [
                {'id': 'type-1', 'code': 'GEN', 'name': 'General'},
              ],
              'totalElements': 1,
            }),
      });

      final api = apiWith(server, ['expedient:read', 'expedient:create']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: ExpedientsTab(api: api)),
      ));
      await tester.pumpAndSettle();

      // Verificar que el botón flotante existe
      final fab = find.byKey(const Key('new-radicacion-fab'));
      expect(fab, findsOneWidget);
      expect(find.text('Radicar solicitud'), findsOneWidget);

      // Al tocarlo se despliega el wizard
      await tester.tap(fab);
      await tester.pumpAndSettle();

      expect(find.text('Buzón de Radicación Digital'), findsOneWidget);
      expect(find.text('Tipo de radicación / PQRS'), findsOneWidget);

      // Verificar que el diálogo de éxito muestra el comprobante al invocarse
      final dummyResult = const RadicacionResultModel(
        expedientId: 'exp-99',
        expedientCode: 'RAD-2026-998877',
        expedientName: 'Petición: Certificado',
        createdAt: '2026-11-17T11:00:00Z',
      );

      final ctx = tester.element(find.byType(RadicacionWizardSheet));
      showRadicacionSuccessDialog(ctx, api, dummyResult);
      await tester.pumpAndSettle();

      expect(find.text('¡Radicación Exitosa!'), findsOneWidget);
      expect(find.byKey(const Key('radicacion-success-code')), findsOneWidget);
      expect(find.text('RAD-2026-998877'), findsOneWidget);
    });
  });
}
