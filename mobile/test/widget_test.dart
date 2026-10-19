import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/errors/api_exception.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/main.dart';
import 'package:nexodocs_mobile/screens/documents/documents_tab.dart';
import 'package:nexodocs_mobile/screens/shell/main_shell_page.dart';
import 'package:nexodocs_mobile/screens/tasks/task_detail_page.dart';

/// Servidor simulado: responde según "MÉTODO /ruta" y registra las peticiones.
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

final tenants = FakeServer.json([
  {'id': '20000000-0000-0000-0000-000000000001', 'name': 'FinoCode'},
]);

Map<String, dynamic> page(List<Map<String, dynamic>> items) =>
    {'content': items, 'totalElements': items.length, 'number': 0, 'size': 30};

/// Pantalla de teléfono (360x800 lógicos) para que el formulario quepa como en un dispositivo real.
void usePhoneScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

Widget host(Widget child) => MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: child));

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('login carga las organizaciones y exige organización, usuario y contraseña', (tester) async {
    usePhoneScreen(tester);
    final server = FakeServer({'GET /tenants/public': (_) => tenants});
    await tester.pumpWidget(NexoDocsApp(authApi: AuthApi(client: server.client)));
    await tester.pumpAndSettle();

    await tapVisible(tester, find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(find.text('Selecciona tu organización'), findsOneWidget);
    expect(find.text('Campo obligatorio'), findsNWidgets(2));
    await tapVisible(tester, find.byKey(const Key('tenant')));
    await tester.pumpAndSettle();
    expect(find.text('FinoCode'), findsWidgets);
  });

  testWidgets('login correcto guarda la sesión y abre el shell', (tester) async {
    usePhoneScreen(tester);
    final server = FakeServer({
      'GET /tenants/public': (_) => tenants,
      'POST /auth/login': (_) => FakeServer.json({'token': 'access-1', 'refreshToken': 'refresh-1', 'expiresIn': 1000}),
      'GET /dashboard': (_) => FakeServer.json({'currentUser': {'firstName': 'Laura', 'lastName': 'Martínez', 'tenantName': 'FinoCode'}, 'recentDocuments': [], 'recentActivity': []}),
      'GET /workflows/tasks': (_) => FakeServer.json(page([])),
      'GET /workflows/notifications': (_) => FakeServer.json(page([])),
      'GET /documents': (_) => FakeServer.json(page([])),
      'GET /patients': (_) => FakeServer.json(page([])),
      'GET /auth/me': (_) => FakeServer.json({'firstName': 'Laura', 'lastName': 'Martínez', 'email': 'laura@acme.com', 'tenantName': 'FinoCode'}),
    });
    await tester.pumpWidget(NexoDocsApp(authApi: AuthApi(client: server.client)));
    await tester.pumpAndSettle();

    await tapVisible(tester, find.byKey(const Key('tenant')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('FinoCode').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('username')), 'laura@acme.com');
    await tester.enterText(find.byKey(const Key('password')), 'DemoPass123!');
    await tapVisible(tester, find.byKey(const Key('login-submit')));
    await tester.pumpAndSettle();

    final login = server.requests.firstWhere((r) => r.url.path.endsWith('/auth/login'));
    expect(jsonDecode(login.body), {'tenantId': '20000000-0000-0000-0000-000000000001', 'usernameOrEmail': 'laura@acme.com', 'password': 'DemoPass123!'});
    expect(find.byType(MainShellPage), findsOneWidget);
    expect(find.textContaining('Laura Martínez'), findsOneWidget);
  });

  test('ante un 401 renueva el token una vez y repite la petición', () async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 'viejo', ApiClient.refreshTokenKey: 'refresh-1'});
    final server = FakeServer({
      'GET /documents': (request) => request.headers['Authorization'] == 'Bearer nuevo'
          ? FakeServer.json(page([{'id': 'd1', 'name': 'Contrato'}]))
          : http.Response('', 401),
      'POST /auth/refresh': (_) => FakeServer.json({'token': 'nuevo', 'refreshToken': 'refresh-2'}),
    });
    final api = AuthApi(client: server.client);

    final docs = await api.documents.list();

    expect(docs.single['name'], 'Contrato');
    expect(jsonDecode(server.requests.firstWhere((r) => r.url.path.endsWith('/auth/refresh')).body), {'refreshToken': 'refresh-1'});
    expect(await api.client.storage.read(key: ApiClient.refreshTokenKey), 'refresh-2');
  });

  test('si la renovación falla, la sesión expira y se avisa a la app', () async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 'viejo', ApiClient.refreshTokenKey: 'caducado'});
    final server = FakeServer({
      'GET /documents': (_) => http.Response('', 401),
      'POST /auth/refresh': (_) => http.Response('', 401),
    });
    final api = AuthApi(client: server.client);

    await expectLater(api.documents.list(), throwsA(isA<SessionExpiredException>()));
    expect(api.client.sessionExpired.value, 1);
    expect(await api.client.hasSession(), isFalse);
  });

  testWidgets('si la API falla, documentos muestra el error y no datos inventados', (tester) async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});
    final server = FakeServer({'GET /documents': (_) => FakeServer.json({'message': 'Error interno'}, 500)});
    await tester.pumpWidget(host(DocumentsTab(api: AuthApi(client: server.client))));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('error-state')), findsOneWidget);
    expect(find.text('Error interno'), findsOneWidget);
    expect(find.textContaining('Política de seguridad'), findsNothing);
  });

  testWidgets('la búsqueda de documentos usa el parámetro filter y el estado en código de la API', (tester) async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});
    final server = FakeServer({
      'GET /documents': (_) => FakeServer.json(page([{'id': 'd1', 'name': 'Contrato marco', 'code': 'DOC-1', 'status': 'IN_REVIEW'}])),
    });
    await tester.pumpWidget(host(DocumentsTab(api: AuthApi(client: server.client))));
    await tester.pumpAndSettle();
    expect(find.text('En revisión'), findsWidgets);

    await tester.tap(find.widgetWithText(FilterChip, 'Aprobado'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(SearchBar), 'contrato');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    final last = server.requests.last.url.queryParameters;
    expect(last['filter'], 'contrato');
    expect(last['status'], 'APPROVED');
  });

  testWidgets('una tarea de aprobación se aprueba contra la API con el payload de la web', (tester) async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});
    final task = {
      'id': 'task-1',
      'title': 'Aprobar contrato',
      'workflow_title': 'Aprobación de contrato marco',
      'workflow_code': 'WF-1',
      'status': 'PENDING',
      'stage_type': 'APPROVAL',
      'stage_id': 's2',
      'can_act': true,
      'rules': {},
      'checklist_items': [],
      'comments': [],
      'events': [],
      'stages': [
        {'id': 's1', 'name': 'Inicio', 'stage_type': 'START', 'sort_order': 1},
        {'id': 's2', 'name': 'Aprobación', 'stage_type': 'APPROVAL', 'sort_order': 2},
      ],
    };
    final server = FakeServer({
      'GET /workflows/tasks/task-1': (_) => FakeServer.json(task),
      'POST /workflows/tasks/task-1/actions': (_) => FakeServer.json({...task, 'status': 'COMPLETED'}),
    });
    await tester.pumpWidget(MaterialApp(home: TaskDetailPage(api: AuthApi(client: server.client), taskId: 'task-1')));
    await tester.pumpAndSettle();

    expect(find.text('Aprobar'), findsOneWidget);
    await tester.tap(find.byKey(const Key('task-primary-action')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('action-comment')), 'Conforme');
    await tester.tap(find.byKey(const Key('action-confirm')));
    await tester.pumpAndSettle();

    final action = server.requests.firstWhere((r) => r.method == 'POST');
    expect(jsonDecode(action.body), {
      'action': 'APPROVE',
      'comment': 'Conforme',
      'targetUserId': null,
      'returnStageId': null,
      'checklist': {},
    });
    expect(find.text('Aprobar: operación realizada.'), findsOneWidget);
  });

  testWidgets('rechazar exige comentario antes de llamar a la API', (tester) async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});
    final server = FakeServer({
      'GET /workflows/tasks/task-2': (_) => FakeServer.json({
        'id': 'task-2', 'title': 'Revisar', 'status': 'PENDING', 'stage_type': 'REVIEW', 'stage_id': 's2', 'can_act': true,
        'rules': {}, 'checklist_items': [], 'comments': [], 'events': [],
        'stages': [{'id': 's2', 'name': 'Revisión', 'stage_type': 'REVIEW', 'sort_order': 2}],
      }),
    });
    await tester.pumpWidget(MaterialApp(home: TaskDetailPage(api: AuthApi(client: server.client), taskId: 'task-2')));
    await tester.pumpAndSettle();

    expect(find.text('Marcar como revisada'), findsOneWidget);
    await tester.tap(find.byTooltip('Más acciones'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rechazar'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('action-confirm')));
    await tester.pump();

    expect(find.text('El comentario es obligatorio para esta acción.'), findsOneWidget);
    expect(server.requests.where((r) => r.method == 'POST'), isEmpty);
  });

  testWidgets('shell móvil contiene las 5 pestañas de navegación', (tester) async {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});
    final server = FakeServer({});
    await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: MainShellPage(api: AuthApi(client: server.client))));
    await tester.pumpAndSettle();

    for (final label in ['Inicio', 'Documentos', 'Tareas', 'Clínico', 'Perfil']) {
      expect(find.text(label), findsWidgets);
    }
  });
}
