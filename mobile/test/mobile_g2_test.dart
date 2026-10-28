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
import 'package:nexodocs_mobile/core/auth/biometric_service.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/documents/documents_tab.dart';
import 'package:nexodocs_mobile/screens/profile/profile_tab.dart';
import 'package:nexodocs_mobile/screens/tasks/tasks_tab.dart';

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

Widget testHost(Widget child) => MaterialApp(
      theme: AppTheme.lightTheme,
      home: Scaffold(body: child),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    PathProviderPlatform.instance = FakePathProviderPlatform();
    FlutterSecureStorage.setMockInitialValues({
      ApiClient.accessTokenKey: 'test-token',
      ApiClient.refreshTokenKey: 'test-refresh',
    });
  });

  group('Tarea G2 - BiometricService', () {
    test('isEnabled y setEnabled persisten el estado en FlutterSecureStorage', () async {
      final storage = const FlutterSecureStorage();
      final bio = BiometricService(storage: storage);

      expect(await bio.isEnabled(), isFalse);
      await bio.setEnabled(true);
      expect(await bio.isEnabled(), isTrue);
      await bio.setEnabled(false);
      expect(await bio.isEnabled(), isFalse);
    });
  });

  group('Tarea G2 - Descarga real de documentos (documents_tab)', () {
    testWidgets('botón de descarga en la tarjeta llama al endpoint de versiones y contenido', (tester) async {
      var contentCalled = false;
      final server = FakeServer({
        'GET /documents': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'doc-123',
                  'name': 'Contrato Marco',
                  'code': 'DOC-2026',
                  'currentVersion': 1,
                  'documentTypeName': 'Contrato',
                  'status': 'APPROVED',
                }
              ],
              'totalElements': 1,
            }),
        'GET /documents/doc-123/versions': (_) => FakeServer.json([
              {
                'id': 'ver-456',
                'versionNumber': 1,
                'fileName': 'contrato.pdf',
                'fileSizeBytes': 1024,
                'createdAt': '2026-10-21T00:00:00Z',
              }
            ]),
        'GET /documents/doc-123/versions/ver-456/content': (_) {
          contentCalled = true;
          return http.Response.bytes(utf8.encode('%PDF-1.4 test file'), 200, headers: {'content-type': 'application/pdf'});
        },
      });

      final authApi = AuthApi(client: server.client);
      await tester.pumpWidget(testHost(DocumentsTab(
        api: authApi,
        onOpenFile: (path) async {},
      )));
      await tester.pumpAndSettle();

      expect(find.text('Contrato Marco'), findsOneWidget);
      final downloadBtn = find.byKey(const Key('download-doc-doc-123'));
      expect(downloadBtn, findsOneWidget);

      await tester.tap(downloadBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(contentCalled, isTrue);
    });

    testWidgets('si el documento no tiene versiones muestra aviso oportuno', (tester) async {
      final server = FakeServer({
        'GET /documents': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'doc-empty',
                  'name': 'Documento Vacío',
                  'code': 'DOC-0000',
                  'currentVersion': 0,
                  'documentTypeName': 'Nota',
                  'status': 'DRAFT',
                }
              ],
              'totalElements': 1,
            }),
        'GET /documents/doc-empty/versions': (_) => FakeServer.json([]),
      });

      final authApi = AuthApi(client: server.client);
      await tester.pumpWidget(testHost(DocumentsTab(api: authApi)));
      await tester.pumpAndSettle();

      final downloadBtn = find.byKey(const Key('download-doc-doc-empty'));
      expect(downloadBtn, findsOneWidget);

      await tester.tap(downloadBtn);
      await tester.pumpAndSettle();

      expect(find.text('Este documento aún no tiene archivos registrados.'), findsOneWidget);
    });
  });

  group('Tarea G2 - Tareas conectadas a la API real (tasks_tab)', () {
    testWidgets('cambio de estado desde la tarjeta ejecuta POST /workflows/tasks/{id}/actions', (tester) async {
      var actCalled = false;
      final server = FakeServer({
        'GET /workflows/tasks': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'task-777',
                  'title': 'Revisar expediente',
                  'workflow_title': 'Flujo de Expedición',
                  'workflow_code': 'EXP-01',
                  'stage_type': 'TASK',
                  'status': 'PENDING',
                  'can_act': true,
                  'priority': 2,
                }
              ],
              'totalElements': 1,
            }),
        'POST /workflows/tasks/task-777/actions': (req) {
          actCalled = true;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['action'], 'COMPLETE');
          return FakeServer.json({'id': 'task-777', 'status': 'COMPLETED'});
        },
      });

      final authApi = AuthApi(client: server.client);
      await tester.pumpWidget(testHost(TasksTab(api: authApi)));
      await tester.pumpAndSettle();

      expect(find.text('Revisar expediente'), findsOneWidget);
      final quickBtn = find.byKey(const Key('quick-action-task-777'));
      expect(quickBtn, findsOneWidget);
      expect(find.text('Completar'), findsOneWidget);

      await tester.tap(quickBtn);
      await tester.pumpAndSettle();

      expect(actCalled, isTrue);
      expect(find.text('Operación "Completar" completada con éxito.'), findsOneWidget);
    });

    testWidgets('si la acción de tarea falla en el servidor muestra error real', (tester) async {
      final server = FakeServer({
        'GET /workflows/tasks': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'task-888',
                  'title': 'Aprobación directiva',
                  'workflow_title': 'Flujo de Compras',
                  'workflow_code': 'COM-02',
                  'stage_type': 'APPROVAL',
                  'status': 'PENDING',
                  'can_act': true,
                  'priority': 1,
                }
              ],
              'totalElements': 1,
            }),
        'POST /workflows/tasks/task-888/actions': (_) =>
            FakeServer.json({'message': 'Se requiere justificación para esta etapa.'}, 400),
      });

      final authApi = AuthApi(client: server.client);
      await tester.pumpWidget(testHost(TasksTab(api: authApi)));
      await tester.pumpAndSettle();

      final quickBtn = find.byKey(const Key('quick-action-task-888'));
      expect(quickBtn, findsOneWidget);
      expect(find.text('Aprobar'), findsOneWidget);

      await tester.tap(quickBtn);
      await tester.pumpAndSettle();

      expect(find.text('Se requiere justificación para esta etapa.'), findsOneWidget);
      expect(find.text('Ver detalle'), findsOneWidget);
    });
  });

  group('Tarea G2 - Perfil con interruptor de biometría', () {
    testWidgets('ProfileTab muestra sección de seguridad y estado de biometría', (tester) async {
      final server = FakeServer({
        'GET /auth/me': (_) => FakeServer.json({
              'username': 'cruz',
              'firstName': 'Denilson',
              'lastName': 'Cruz',
              'email': 'cruz@nexodocs.com',
              'roleNames': ['Operador'],
              'tenantName': 'Clínica Central',
            }),
      });

      final authApi = AuthApi(client: server.client);
      await tester.pumpWidget(testHost(ProfileTab(api: authApi)));
      await tester.pumpAndSettle();

      expect(find.text('Seguridad y Dispositivo'), findsOneWidget);
      expect(find.text('Desbloqueo biométrico'), findsOneWidget);
      expect(find.byKey(const Key('biometrics-switch')), findsOneWidget);
    });
  });
}
