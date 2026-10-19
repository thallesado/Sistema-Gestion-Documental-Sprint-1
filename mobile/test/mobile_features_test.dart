import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/notifications/background_worker.dart';
import 'package:nexodocs_mobile/core/notifications/workflow_notifications.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/core/utils/upload_rules.dart';
import 'package:nexodocs_mobile/screens/documents/document_detail_sheet.dart';
import 'package:nexodocs_mobile/screens/documents/upload_version_sheet.dart';
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

Map<String, dynamic> page(List<Map<String, dynamic>> items) => {'content': items, 'totalElements': items.length, 'number': 0, 'size': 30};

void signedIn() => FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});

AuthApi apiWith(FakeServer server, List<String> permissions) =>
    AuthApi(client: server.client)..permissions.value = UserPermissions(permissions.toSet());

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  group('permisos (punto 4)', () {
    test('sin el campo permissions no se oculta nada; con él solo lo concedido', () {
      expect(UserPermissions.fromJson({}).can(Permissions.patientRead), isTrue);
      final perms = UserPermissions.fromJson({
        'permissions': ['document:read', 'task:read'],
      });
      expect(perms.can(Permissions.documentRead), isTrue);
      expect(perms.can(Permissions.patientRead), isFalse);
      expect(perms.canAny([Permissions.patientRead, Permissions.taskRead]), isTrue);
    });

    test('el login guarda los permisos que devuelve el servidor', () async {
      final server = FakeServer({
        'POST /auth/login': (_) => FakeServer.json({
          'token': 't',
          'refreshToken': 'r',
          'permissions': ['document:read'],
        }),
      });
      final api = AuthApi(client: server.client);
      await api.login(tenantId: 'x', username: 'u', password: 'p');
      expect(api.permissions.value.can(Permissions.documentRead), isTrue);
      expect(api.permissions.value.can(Permissions.taskRead), isFalse);
    });

    testWidgets('un perfil con solo document:read ve Inicio, Documentos y Perfil, sin campana', (tester) async {
      signedIn();
      final server = FakeServer({
        'GET /auth/me': (_) => FakeServer.json({
          'firstName': 'Ana',
          'permissions': ['document:read'],
        }),
        'GET /documents': (_) => FakeServer.json(page([])),
      });
      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: MainShellPage(api: AuthApi(client: server.client))));
      await tester.pumpAndSettle();

      for (final label in ['Inicio', 'Documentos', 'Perfil']) {
        expect(find.text(label), findsWidgets);
      }
      expect(find.text('Tareas'), findsNothing);
      expect(find.text('Clínico'), findsNothing);
      expect(find.byKey(const Key('notifications-button')), findsNothing);
      expect(server.requests.where((r) => r.url.path.endsWith('/workflows/notifications')), isEmpty);
    });

    testWidgets('sin workflow:approve ni workflow:reject la tarea se ve pero no se puede aprobar ni rechazar', (tester) async {
      signedIn();
      final server = FakeServer({
        'GET /workflows/tasks/task-1': (_) => FakeServer.json({
          'id': 'task-1',
          'title': 'Aprobar contrato',
          'status': 'PENDING',
          'stage_type': 'APPROVAL',
          'stage_id': 's2',
          'can_act': true,
          'rules': {},
          'checklist_items': [],
          'comments': [],
          'events': [],
          'stages': [
            {'id': 's2', 'name': 'Aprobación', 'stage_type': 'APPROVAL', 'sort_order': 2},
          ],
        }),
      });
      final api = apiWith(server, ['task:read', 'task:update']);
      await tester.pumpWidget(MaterialApp(home: TaskDetailPage(api: api, taskId: 'task-1')));
      await tester.pumpAndSettle();

      expect(find.text('Tu perfil no puede aprobar en esta etapa.'), findsOneWidget);
      expect(find.byKey(const Key('task-primary-action')), findsNothing);
      expect(find.byTooltip('Más acciones'), findsNothing);
      expect(find.byKey(const Key('task-comment')), findsOneWidget, reason: 'comentar solo exige task:update');
    });
  });

  group('subir versión (punto 2)', () {
    test('las reglas coinciden con el servidor: formato, 25 MB y motivo obligatorio', () {
      expect(UploadRules.mimeFor('foto.JPG'), 'image/jpeg');
      expect(UploadRules.mimeFor('acta.webp'), isNull);
      expect(UploadRules.validate(fileName: 'a.pdf', sizeBytes: 10, reason: ' '), 'Indica el motivo de la nueva versión.');
      expect(UploadRules.validate(fileName: 'a.pdf', sizeBytes: UploadRules.maxBytes + 1, reason: 'x'), 'El archivo supera 25 MB.');
      expect(UploadRules.validate(fileName: 'a.heic', sizeBytes: 10, reason: 'x'), contains('Formato no permitido'));
      expect(UploadRules.validate(fileName: 'a.pdf', sizeBytes: 10, reason: 'Firma escaneada'), isNull);
    });

    Map<String, dynamic> document() => {'id': 'doc-1', 'name': 'Contrato', 'code': 'DOC-1', 'status': 'DRAFT'};

    testWidgets('sin document:update no aparece el botón de nueva versión', (tester) async {
      signedIn();
      final server = FakeServer({
        'GET /documents/doc-1': (_) => FakeServer.json(document()),
        'GET /documents/doc-1/versions': (_) => FakeServer.json([]),
      });
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: DocumentDetailSheet(api: apiWith(server, ['document:read']), documentId: 'doc-1'))));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('upload-version')), findsNothing);
    });

    testWidgets('una foto de la cámara se sube como multipart con el motivo y recarga las versiones', (tester) async {
      signedIn();
      final photo = File('${Directory.systemTemp.createTempSync('nexodocs').path}/foto.jpg')..writeAsBytesSync([0xff, 0xd8, 0xff, 0xd9]);
      var versions = <Map<String, dynamic>>[];
      final server = FakeServer({
        'GET /documents/doc-1': (_) => FakeServer.json(document()),
        'GET /documents/doc-1/versions': (_) => FakeServer.json(versions),
        'POST /documents/doc-1/versions': (_) {
          versions = [
            {'id': 'v1', 'versionNumber': 1, 'fileName': 'foto_1.jpg', 'fileSizeBytes': 4},
          ];
          return FakeServer.json(versions.first, 201);
        },
      });
      Future<PickedUpload?> fakeCamera(UploadOrigin origin) async =>
          PickedUpload(path: photo.path, name: 'foto_1.jpg', sizeBytes: 4, isImage: true);

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: DocumentDetailSheet(api: apiWith(server, ['document:read', 'document:update']), documentId: 'doc-1', picker: fakeCamera),
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Versiones (0)'), findsOneWidget);

      await tester.tap(find.byKey(const Key('upload-version')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('upload-submit')));
      await tester.pump();
      expect(find.text('Toma una foto o elige un archivo.'), findsOneWidget);

      await tester.tap(find.byKey(const Key('origin-camera')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('picked-file')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('version-reason')), 'Firma del cliente');
      await tester.tap(find.byKey(const Key('upload-submit')));
      await tester.pumpAndSettle();

      final upload = server.requests.singleWhere((r) => r.method == 'POST');
      expect(upload.headers['content-type'], startsWith('multipart/form-data'));
      final body = latin1.decode(upload.bodyBytes);
      expect(body, contains('name="changeReason"'));
      expect(body, contains('Firma del cliente'));
      expect(body, contains('filename="foto_1.jpg"'));
      expect(body, contains('content-type: image/jpeg'));
      expect(find.text('Versiones (1)'), findsOneWidget);
    });
  });

  group('avisos del sistema (punto 3)', () {
    final older = DateTime.utc(2026, 10, 18, 10);
    Map<String, dynamic> notice(String id, DateTime at, {bool read = false}) => {
      'id': id,
      'title': 'Tarea $id',
      'message': 'Revisar',
      'created_at': at.toIso8601String(),
      'is_read': read,
      'related_entity_type': 'workflow_task',
      'related_entity_id': 'task-$id',
    };

    test('solo son nuevos los no leídos posteriores a la marca, del más antiguo al más reciente', () {
      final items = [
        notice('c', older.add(const Duration(minutes: 9))),
        notice('a', older.subtract(const Duration(minutes: 1))),
        notice('b', older.add(const Duration(minutes: 5))),
        notice('d', older.add(const Duration(minutes: 7)), read: true),
      ];
      expect(unreadSince(items, older).map((i) => i['id']), ['b', 'c']);
      expect(newestCreatedAt(items), older.add(const Duration(minutes: 9)));
    });

    test('la primera comprobación solo guarda la marca para no avisar de lo antiguo', () async {
      const storage = FlutterSecureStorage();
      final shown = await WorkflowNotifications.instance.notifyNew([notice('a', older)], storage: storage);
      expect(shown, 0);
      expect(await storage.read(key: WorkflowNotifications.seenUntilKey), older.toIso8601String());
    });

    test('en segundo plano no renueva la sesión ni la borra si el token caducó', () async {
      signedIn();
      final calls = <String>[];
      final client = MockClient((request) async {
        calls.add(request.url.path);
        return http.Response('{"message":"expirado"}', 401);
      });
      const storage = FlutterSecureStorage();

      expect(await checkWorkflowNotificationsInBackground(storage: storage, client: client), 0);
      expect(calls, ['/api/v1/workflows/notifications']);
      expect(await storage.read(key: ApiClient.refreshTokenKey), 'r');
    });

    test('sin sesión guardada no consulta el servidor', () async {
      var called = false;
      final client = MockClient((_) async {
        called = true;
        return http.Response('{}', 200);
      });
      expect(await checkWorkflowNotificationsInBackground(client: client), 0);
      expect(called, isFalse);
    });
  });
}
