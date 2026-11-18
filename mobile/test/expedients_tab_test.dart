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
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/expedients/expedient_detail_sheet.dart';
import 'package:nexodocs_mobile/screens/expedients/expedients_tab.dart';
import 'package:nexodocs_mobile/screens/shell/main_shell_page.dart';

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

  group('Expedientes Digitales - Experiencia Usuario Final y Administrativo', () {
    testWidgets('ExpedientsTab lista radicaciones, permite filtrar por estado y buscar', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final server = FakeServer({
        'GET /expedients': (req) {
          final status = req.url.queryParameters['status'];
          final filter = req.url.queryParameters['filter'];

          if (status == 'CLOSED') {
            return FakeServer.json({
              'content': [
                {
                  'id': 'exp-closed-1',
                  'code': 'EXP-2025-0099',
                  'name': 'Construcción Hospitalario 2025',
                  'description': 'Expediente cerrado tras liquidación de obra.',
                  'status': 'CLOSED',
                  'createdAt': '2025-10-10T08:00:00Z',
                  'updatedAt': '2026-01-15T12:00:00Z',
                  'closedAt': '2026-01-15T12:00:00Z',
                }
              ],
              'totalElements': 1,
            });
          }

          if (filter == 'Ambiental') {
            return FakeServer.json({
              'content': [
                {
                  'id': 'exp-1',
                  'code': 'EXP-2026-0001',
                  'name': 'Licencia Ambiental Parque Eólico',
                  'description': 'Estudios de impacto ambiental y aprobación del parque eólico.',
                  'status': 'ACTIVE',
                  'createdAt': '2026-02-01T10:00:00Z',
                  'updatedAt': '2026-02-10T14:30:00Z',
                }
              ],
              'totalElements': 1,
            });
          }

          return FakeServer.json({
            'content': [
              {
                'id': 'exp-1',
                'code': 'EXP-2026-0001',
                'name': 'Licencia Ambiental Parque Eólico',
                'description': 'Estudios de impacto ambiental y aprobación del parque eólico.',
                'status': 'ACTIVE',
                'createdAt': '2026-02-01T10:00:00Z',
                'updatedAt': '2026-02-10T14:30:00Z',
              },
              {
                'id': 'exp-2',
                'code': 'EXP-2026-0002',
                'name': 'Contratación Pública Licitación 04',
                'description': 'Pliego y evaluación de oferentes.',
                'status': 'ACTIVE',
                'createdAt': '2026-02-05T11:00:00Z',
                'updatedAt': '2026-02-12T16:00:00Z',
              }
            ],
            'totalElements': 2,
          });
        },
      });

      final api = apiWith(server, ['expedient:read']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: ExpedientsTab(api: api)),
      ));
      await tester.pumpAndSettle();

      // Verificar lista inicial
      expect(find.text('EXP-2026-0001'), findsOneWidget);
      expect(find.text('Licencia Ambiental Parque Eólico'), findsOneWidget);
      expect(find.text('EXP-2026-0002'), findsOneWidget);
      expect(find.text('2 expedientes'), findsOneWidget);

      // Filtrar por chip de estado 'Cerrados'
      final chipClosed = find.byKey(const Key('chip-status-CLOSED'));
      expect(chipClosed, findsOneWidget);
      await tester.tap(chipClosed);
      await tester.pumpAndSettle();

      expect(find.text('EXP-2025-0099'), findsOneWidget);
      expect(find.text('Construcción Hospitalario 2025'), findsOneWidget);
      expect(find.text('Cerrado'), findsWidgets);

      // Volver a 'Todos'
      final chipAll = find.byKey(const Key('chip-status-ALL'));
      await tester.tap(chipAll);
      await tester.pumpAndSettle();

      // Búsqueda por texto
      final searchInput = find.byKey(const Key('expedient-search-input'));
      await tester.enterText(searchInput, 'Ambiental');
      // Esperar timer debounce
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.text('EXP-2026-0001'), findsOneWidget);
      expect(find.text('EXP-2026-0002'), findsNothing);
    });

    testWidgets('ExpedientDetailSheet agrupa trámites y documentos bajo la misma radicación', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      var downloadCalled = false;
      final server = FakeServer({
        'GET /expedients/exp-1': (_) => FakeServer.json({
              'id': 'exp-1',
              'code': 'EXP-2026-0001',
              'name': 'Licencia Ambiental Parque Eólico',
              'description': 'Estudios de impacto ambiental y aprobación del parque eólico.',
              'status': 'ACTIVE',
              'createdAt': '2026-02-01T10:00:00Z',
              'updatedAt': '2026-02-10T14:30:00Z',
              'metadata': {
                'participants': [
                  {'source': 'USER', 'name': 'Ing. Carlos Mendoza', 'role': 'Interventor'},
                  {'source': 'CUSTOM', 'name': 'Consorcio Energía Renovable', 'role': 'Solicitante'},
                ]
              },
            }),
        'GET /workflows': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'wf-exp-1',
                  'code': 'WF-2026-000045',
                  'title': 'Aprobación de Estudio Ambiental',
                  'status': 'IN_PROGRESS',
                  'progress': 65,
                  'stage_name': 'Dictamen Técnico',
                  'responsible_name': 'Dra. María Salazar',
                }
              ],
              'totalElements': 1,
            }),
        'GET /workflows/wf-exp-1': (_) => FakeServer.json({
              'id': 'wf-exp-1',
              'code': 'WF-2026-000045',
              'title': 'Aprobación de Estudio Ambiental',
              'status': 'IN_PROGRESS',
              'progress': 65,
              'stage_name': 'Dictamen Técnico',
              'responsible_name': 'Dra. María Salazar',
              'stages': [
                {'id': 's1', 'name': 'Revisión Preliminar', 'stage_type': 'TASK', 'sort_order': 1},
                {'id': 's2', 'name': 'Dictamen Técnico', 'stage_type': 'REVIEW', 'sort_order': 2},
              ],
              'events': [
                {'id': 'e1', 'event_type': 'STARTED', 'actor_name': 'Carlos Mendoza', 'performed_at': '2026-02-01T10:05:00Z'},
              ],
            }),
        'GET /documents': (_) => FakeServer.json({
              'content': [
                {
                  'id': 'doc-exp-1',
                  'code': 'EXP-2026-0001-D01',
                  'name': 'Estudio_Impacto_Fase1.pdf',
                  'status': 'APPROVED',
                  'currentVersion': 2,
                  'createdAt': '2026-02-01T10:15:00Z',
                }
              ],
              'totalElements': 1,
            }),
        'GET /documents/doc-exp-1/versions': (_) => FakeServer.json([
              {
                'id': 'v-1',
                'versionNumber': 2,
                'fileName': 'Estudio_Impacto_Fase1.pdf',
                'fileSizeBytes': 10240,
                'createdAt': '2026-02-02T10:00:00Z',
              }
            ]),
        'GET /documents/doc-exp-1/versions/v-1/content': (_) {
          downloadCalled = true;
          return http.Response.bytes([1, 2, 3, 4], 200);
        },
      });

      final api = apiWith(server, ['expedient:read', 'workflow:read', 'document:read']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: ExpedientDetailSheet(
            api: api,
            expedientId: 'exp-1',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Verificar cabecera del expediente
      expect(find.text('EXP-2026-0001'), findsWidgets);
      expect(find.text('Licencia Ambiental Parque Eólico'), findsOneWidget);
      expect(find.text('Ing. Carlos Mendoza (Interventor)'), findsOneWidget);

      // Verificar sección de trámites en curso
      expect(find.text('Trámites en curso (1)'), findsOneWidget);
      expect(find.text('WF-2026-000045'), findsOneWidget);
      expect(find.text('65%'), findsOneWidget);
      expect(find.text('Etapa: Dictamen Técnico · Responsable: Dra. María Salazar'), findsOneWidget);

      // Verificar documentos radicados
      expect(find.text('Documentos radicados (1)'), findsOneWidget);
      expect(find.text('Estudio_Impacto_Fase1.pdf'), findsOneWidget);
      expect(find.byKey(const Key('download-doc-doc-exp-1')), findsOneWidget);

      // Abrir el seguimiento de trámite desde el expediente
      final wfCard = find.byKey(const Key('expedient-workflow-wf-exp-1'));
      await tester.tap(wfCard);
      await tester.pumpAndSettle();

      // Debe abrir la hoja modal de seguimiento de workflow
      expect(find.byKey(const Key('workflow-stages-timeline')), findsOneWidget);
      expect(find.text('Revisión Preliminar'), findsOneWidget);

      // Cerrar la hoja de seguimiento
      Navigator.of(tester.element(find.byKey(const Key('workflow-stages-timeline')))).pop();
      await tester.pumpAndSettle();

      // Descargar archivo radicado
      await tester.tap(find.byKey(const Key('download-doc-doc-exp-1')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      expect(downloadCalled, isTrue);
    });

    testWidgets('ExpedientDetailSheet permite a administrativos cerrar y reabrir el expediente', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      var closeCalled = false;
      var reopenCalled = false;

      final server = FakeServer({
        'GET /expedients/exp-admin': (_) => FakeServer.json({
              'id': 'exp-admin',
              'code': 'EXP-2026-ADM1',
              'name': 'Contrato Auditoría Externa',
              'status': 'ACTIVE',
              'createdAt': '2026-02-01T10:00:00Z',
              'updatedAt': '2026-02-10T14:30:00Z',
            }),
        'PATCH /expedients/exp-admin/close': (_) {
          closeCalled = true;
          return FakeServer.json({
            'id': 'exp-admin',
            'code': 'EXP-2026-ADM1',
            'name': 'Contrato Auditoría Externa',
            'status': 'CLOSED',
            'createdAt': '2026-02-01T10:00:00Z',
            'updatedAt': '2026-02-16T10:00:00Z',
            'closedAt': '2026-02-16T10:00:00Z',
          });
        },
        'PATCH /expedients/exp-admin/reopen': (_) {
          reopenCalled = true;
          return FakeServer.json({
            'id': 'exp-admin',
            'code': 'EXP-2026-ADM1',
            'name': 'Contrato Auditoría Externa',
            'status': 'ACTIVE',
            'createdAt': '2026-02-01T10:00:00Z',
            'updatedAt': '2026-02-16T11:00:00Z',
          });
        },
        'GET /workflows': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /documents': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
      });

      final api = apiWith(server, ['expedient:read', 'expedient:update']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: ExpedientDetailSheet(
            api: api,
            expedientId: 'exp-admin',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Botón para cerrar
      final closeBtn = find.byKey(const Key('close-expedient-button'));
      expect(closeBtn, findsOneWidget);

      await tester.tap(closeBtn);
      await tester.pumpAndSettle();

      // Confirmar en el modal de confirmación
      expect(find.text('¿Confirmar cierre de expediente?'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(closeCalled, isTrue);
      expect(find.text('Expediente actualizado: Cerrado'), findsOneWidget);

      // Ahora que está cerrado, debe estar disponible el botón de reabrir
      final reopenBtn = find.byKey(const Key('reopen-expedient-button'));
      expect(reopenBtn, findsOneWidget);

      await tester.tap(reopenBtn);
      await tester.pumpAndSettle();

      expect(find.text('¿Confirmar reapertura de expediente?'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(reopenCalled, isTrue);
      expect(find.text('Expediente actualizado: Activo'), findsOneWidget);
    });

    testWidgets('MainShellPage muestra la pestaña de Expedientes cuando el usuario tiene permiso expedient:read', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final server = FakeServer({
        'GET /auth/me': (_) => FakeServer.json({
              'id': 'usr-1',
              'username': 'admin',
              'email': 'admin@nexodocs.com',
              'firstName': 'Admin',
              'lastName': 'NexoDocs',
              'permissions': ['expedient:read', 'document:read', 'task:read'],
            }),
        'GET /workflows/notifications': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /workflows/tasks': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /dashboard': (_) => FakeServer.json({
              'currentUser': {'firstName': 'Admin', 'lastName': 'NexoDocs', 'tenantName': 'Gobernación'},
              'pendingTasks': [],
              'recentDocuments': [],
              'recentActivity': [],
            }),
      });

      final api = apiWith(server, ['expedient:read', 'document:read', 'task:read']);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: MainShellPage(api: api),
      ));
      await tester.pumpAndSettle();

      // La pestaña 'Expedientes' debe existir en el shell
      expect(find.text('Expedientes'), findsWidgets);
      // El dashboard muestra el card de acceso a Expedientes
      expect(find.byKey(const Key('dashboard-expedients-card')), findsOneWidget);
    });

    testWidgets('en Expedientes, Radicar solicitud y Escanear no se tapan entre sí', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.75;
      addTearDown(tester.view.reset);
      const permissions = ['expedient:read', 'expedient:create', 'document:read', 'document:create', 'task:read'];
      final server = FakeServer({
        'GET /auth/me': (_) => FakeServer.json({
              'id': 'usr-1', 'username': 'admin', 'email': 'admin@nexodocs.com', 'firstName': 'Admin', 'lastName': 'NexoDocs',
              'permissions': permissions,
            }),
        'GET /workflows/notifications': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /workflows/tasks': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /dashboard': (_) => FakeServer.json({'currentUser': {'firstName': 'Admin'}, 'pendingTasks': [], 'recentDocuments': [], 'recentActivity': []}),
        'GET /expedients': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
        'GET /documents': (_) => FakeServer.json({'content': [], 'totalElements': 0}),
      });

      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: MainShellPage(api: apiWith(server, permissions))));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('scan-fab')), findsOneWidget);

      await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Expedientes')));
      await tester.pumpAndSettle();

      // Un solo botón flotante en la esquina: Radicar solicitud. Escanear sigue en la barra superior.
      expect(find.byKey(const Key('new-radicacion-fab')), findsOneWidget);
      expect(find.byKey(const Key('scan-fab')), findsNothing);
      expect(find.byTooltip('Escanear con cámara'), findsOneWidget);
    });
  });
}
