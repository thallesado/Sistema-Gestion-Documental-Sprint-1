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
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/documents/document_detail_sheet.dart';
import 'package:nexodocs_mobile/screens/tasks/task_detail_page.dart';
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

class FakeBiometricService extends BiometricService {
  FakeBiometricService({required this.enabled, required this.shouldAuthenticate});

  final bool enabled;
  bool shouldAuthenticate;
  int authCalls = 0;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<bool> authenticate({String reason = ''}) async {
    authCalls++;
    return shouldAuthenticate;
  }
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

  group('Seguimiento de Trámites en Tiempo Real', () {
    testWidgets('DocumentDetailSheet muestra la tarjeta de trámite y abre el seguimiento de etapas y eventos', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final server = FakeServer({
        'GET /documents/doc-100': (_) => FakeServer.json({
              'id': 'doc-100',
              'name': 'Solicitud de Licencia',
              'code': 'DOC-2026-001',
              'status': 'IN_REVIEW',
              'currentVersion': 1,
            }),
        'GET /documents/doc-100/versions': (_) => FakeServer.json([
              {
                'id': 'v1',
                'versionNumber': 1,
                'fileName': 'solicitud.pdf',
                'fileSizeBytes': 2048,
                'createdAt': '2026-11-14T10:00:00Z',
              }
            ]),
        'GET /workflows': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'wf-100',
                  'code': 'WF-2026-000001',
                  'title': 'Trámite de Licencia',
                  'status': 'IN_PROGRESS',
                  'progress': 50,
                  'stage_name': 'Revisión Legal',
                  'responsible_name': 'Dra. Rodríguez',
                }
              ],
              'totalElements': 1,
            }),
        'GET /workflows/wf-100': (_) => FakeServer.json({
              'id': 'wf-100',
              'code': 'WF-2026-000001',
              'title': 'Trámite de Licencia',
              'status': 'IN_PROGRESS',
              'progress': 50,
              'template_name': 'Aprobación de Licencias',
              'template_version': 1,
              'creator_name': 'Usuario Ciudadano',
              'stage_name': 'Revisión Legal',
              'responsible_name': 'Dra. Rodríguez',
              'total_steps': 2,
              'completed_steps': 1,
              'current_stage_id': 'stage-2',
              'stages': [
                {'id': 'stage-1', 'name': 'Recepción documental', 'stage_type': 'TASK', 'sort_order': 1, 'due_days': 1},
                {'id': 'stage-2', 'name': 'Revisión Legal', 'stage_type': 'REVIEW', 'sort_order': 2, 'due_days': 3},
              ],
              'events': [
                {
                  'id': 'ev-1',
                  'event_type': 'STARTED',
                  'actor_name': 'Usuario Ciudadano',
                  'performed_at': '2026-11-14T10:05:00Z',
                  'comment': 'Solicitud radicada con formulario adjunto.',
                },
                {
                  'id': 'ev-2',
                  'event_type': 'STEP_COMPLETED',
                  'actor_name': 'Mesa de Entrada',
                  'performed_at': '2026-11-14T11:00:00Z',
                  'comment': 'Documentos completos y validados.',
                },
              ],
            }),
      });

      final api = apiWith(server, ['document:read', 'workflow:read']);
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: DocumentDetailSheet(api: api, documentId: 'doc-100')),
      ));
      await tester.pumpAndSettle();

      final trackingTitle = find.text('Seguimiento de trámite');
      await tester.scrollUntilVisible(trackingTitle, 200);

      // Debe mostrar la sección de seguimiento de trámite
      expect(trackingTitle, findsOneWidget);
      expect(find.text('WF-2026-000001'), findsOneWidget);
      expect(find.text('50%'), findsOneWidget);
      expect(find.text('Dra. Rodríguez'), findsOneWidget);

      final timelineBtn = find.byKey(const Key('open-workflow-timeline'));
      expect(timelineBtn, findsOneWidget);

      // Abrir la hoja de seguimiento
      await tester.tap(timelineBtn);
      await tester.pumpAndSettle();

      // Verificar etapas y eventos en la hoja de seguimiento
      expect(find.byKey(const Key('workflow-stages-timeline')), findsOneWidget);
      expect(find.text('Recepción documental'), findsOneWidget);
      expect(find.text('Revisión Legal'), findsNWidgets(2)); // En tarjeta y en timeline
      expect(find.byKey(const Key('workflow-events-list')), findsOneWidget);
      expect(find.text('Solicitud radicada con formulario adjunto.'), findsOneWidget);
    });

    testWidgets('DocumentDetailSheet permite iniciar workflow si no hay flujo activo', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      var startCalled = false;
      final server = FakeServer({
        'GET /documents/doc-200': (_) => FakeServer.json({
              'id': 'doc-200',
              'name': 'Contrato Proveedor',
              'code': 'DOC-2026-002',
              'status': 'DRAFT',
              'currentVersion': 1,
            }),
        'GET /documents/doc-200/versions': (_) => FakeServer.json([
              {
                'id': 'v1',
                'versionNumber': 1,
                'fileName': 'contrato.docx',
                'fileSizeBytes': 4096,
                'createdAt': '2026-11-14T10:00:00Z',
              }
            ]),
        'GET /workflows': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /workflows/templates': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'tpl-1',
                  'name': 'Aprobación simple',
                  'category': 'Administrativo',
                  'origin_type': 'DOCUMENT',
                  'is_active': true,
                  'steps': 2,
                }
              ],
              'totalElements': 1,
            }),
        'POST /workflows': (req) {
          startCalled = true;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['templateId'], 'tpl-1');
          expect(body['documentId'], 'doc-200');
          return FakeServer.json({
            'id': 'wf-new',
            'code': 'WF-2026-000099',
            'title': body['title'],
            'status': 'IN_PROGRESS',
            'progress': 0,
            'stages': [],
            'events': [],
          }, 201);
        },
      });

      final api = apiWith(server, [
        'document:read',
        'workflow:read',
        'workflow:create',
        'workflow:start',
        'workflow_template:read',
      ]);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: DocumentDetailSheet(api: api, documentId: 'doc-200')),
      ));
      await tester.pumpAndSettle();

      final startBtn = find.byKey(const Key('start-workflow-button'));
      await tester.scrollUntilVisible(startBtn, 200);
      expect(startBtn, findsOneWidget);

      await tester.tap(startBtn);
      await tester.pumpAndSettle();

      // Formulario de inicio de workflow
      expect(find.byKey(const Key('workflow-template-select')), findsOneWidget);
      expect(find.byKey(const Key('workflow-title-input')), findsOneWidget);

      final submitBtn = find.byKey(const Key('workflow-start-submit'));
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(startCalled, isTrue);
    });
  });

  group('Firma Biométrica en Aprobaciones', () {
    testWidgets('TaskDetailPage con biometría activa exige autenticación para APPROVE y cancela si falla', (tester) async {
      var actCalled = false;
      final server = FakeServer({
        'GET /workflows/tasks/task-app-1': (_) => FakeServer.json({
              'id': 'task-app-1',
              'title': 'Aprobación de Presupuesto',
              'status': 'PENDING',
              'stage_type': 'APPROVAL',
              'stage_id': 'stg-app',
              'can_act': true,
              'priority': 1,
              'stages': [
                {'id': 'stg-app', 'name': 'Aprobación Directiva', 'stage_type': 'APPROVAL', 'sort_order': 1}
              ],
              'checklist_items': [],
              'comments': [],
              'events': [],
              'rules': {'allowReject': false},
            }),
        'POST /workflows/tasks/task-app-1/actions': (_) {
          actCalled = true;
          return FakeServer.json({'id': 'task-app-1', 'status': 'COMPLETED'});
        },
      });

      final bioService = FakeBiometricService(enabled: true, shouldAuthenticate: false);
      final api = apiWith(server, ['task:read', 'task:update', 'workflow:approve']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: TaskDetailPage(
          api: api,
          taskId: 'task-app-1',
          biometricService: bioService,
        ),
      ));
      await tester.pumpAndSettle();

      final approveBtn = find.byKey(const Key('task-primary-action'));
      expect(approveBtn, findsOneWidget);
      expect(find.byIcon(Icons.fingerprint), findsOneWidget);

      // Tap en Aprobar -> Abre ActionSheet
      await tester.tap(approveBtn);
      await tester.pumpAndSettle();

      // Confirmar en el modal de acción
      final confirmBtn = find.byKey(const Key('action-confirm'));
      expect(confirmBtn, findsOneWidget);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // Como shouldAuthenticate = false, debe haberse solicitado biometría pero cancelarse la acción
      expect(bioService.authCalls, 1);
      expect(actCalled, isFalse);
      expect(find.text('Aprobación cancelada: se requiere verificación biométrica.'), findsOneWidget);

      // Ahora permitir autenticación exitosa
      bioService.shouldAuthenticate = true;
      await tester.tap(approveBtn);
      await tester.pumpAndSettle();

      final confirmBtn2 = find.byKey(const Key('action-confirm'));
      expect(confirmBtn2, findsOneWidget);
      await tester.tap(confirmBtn2);
      await tester.pumpAndSettle();

      expect(bioService.authCalls, 2);
      expect(actCalled, isTrue);
    });

    testWidgets('TasksTab con biometría activa exige autenticación en acción rápida de aprobación', (tester) async {
      var actCalled = false;
      final server = FakeServer({
        'GET /workflows/tasks': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'task-quick-1',
                  'title': 'Aprobación de Viáticos',
                  'workflow_title': 'Flujo Financiero',
                  'workflow_code': 'FIN-01',
                  'stage_type': 'APPROVAL',
                  'status': 'PENDING',
                  'can_act': true,
                  'priority': 2,
                }
              ],
              'totalElements': 1,
            }),
        'POST /workflows/tasks/task-quick-1/actions': (_) {
          actCalled = true;
          return FakeServer.json({'id': 'task-quick-1', 'status': 'COMPLETED'});
        },
      });

      final bioService = FakeBiometricService(enabled: true, shouldAuthenticate: false);
      final api = apiWith(server, ['task:read', 'task:update', 'workflow:approve']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: TasksTab(
            api: api,
            biometricService: bioService,
          ),
        ),
      ));
      await tester.pumpAndSettle();

      final quickBtn = find.byKey(const Key('quick-action-task-quick-1'));
      expect(quickBtn, findsOneWidget);

      await tester.tap(quickBtn);
      await tester.pumpAndSettle();

      expect(bioService.authCalls, 1);
      expect(actCalled, isFalse);
      expect(find.text('Aprobación cancelada: se requiere verificación biométrica.'), findsOneWidget);

      // Con autenticación válida
      bioService.shouldAuthenticate = true;
      await tester.tap(quickBtn);
      await tester.pumpAndSettle();

      expect(bioService.authCalls, 2);
      expect(actCalled, isTrue);
    });
  });
}
