import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/notifications/workflow_notifications.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/notifications/notifications_page.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 'token'}));

  test('el aviso de un flujo lleva al trámite y el de una tarea a la tarea', () {
    expect(
      notificationPayload({'related_entity_type': 'workflow', 'related_entity_id': 'wf-1'}),
      'workflow:wf-1',
    );
    expect(
      notificationPayload({'related_entity_type': 'workflow_task', 'related_entity_id': 'task-1'}),
      'task-1',
    );
    expect(notificationPayload({'related_entity_type': 'document', 'related_entity_id': 'doc-1'}), isNull);
    expect(parseNotificationPayload('workflow:wf-1'), (kind: 'workflow', id: 'wf-1'));
    expect(parseNotificationPayload('task-1'), (kind: 'task', id: 'task-1'));
  });

  testWidgets('tocar un aviso de workflow abre el trámite y uno de tarea abre la tarea', (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final server = _FakeApi({
      'GET /workflows/notifications': (_) => _json({
        'content': [
          {
            'id': 'n-flow',
            'title': 'Flujo nuevo',
            'message': 'El flujo avanzó',
            'created_at': '2026-11-18T10:00:00Z',
            'is_read': true,
            'related_entity_type': 'workflow',
            'related_entity_id': 'wf-1',
          },
          {
            'id': 'n-task',
            'title': 'Tarea asignada',
            'message': 'Tienes una tarea',
            'created_at': '2026-11-18T11:00:00Z',
            'is_read': true,
            'related_entity_type': 'workflow_task',
            'related_entity_id': 'task-1',
          },
        ],
      }),
      'GET /workflows/wf-1': (_) => _json({
        'id': 'wf-1',
        'code': 'WF-1',
        'title': 'Contrato marco',
        'status': 'IN_PROGRESS',
        'stages': [],
        'events': [],
      }),
      'GET /workflows/tasks/task-1': (_) => _json({
        'id': 'task-1',
        'title': 'Revisar contrato',
        'status': 'PENDING',
        'checklist_items': [],
        'comments': [],
        'events': [],
      }),
    });
    final api = AuthApi(client: server.client);

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: NotificationsPage(api: api),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Flujo nuevo'));
    await tester.pumpAndSettle();
    expect(find.text('Contrato marco'), findsOneWidget);

    Navigator.of(tester.element(find.text('Contrato marco'))).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tarea asignada'));
    await tester.pumpAndSettle();
    expect(find.text('Revisar contrato'), findsOneWidget);
    expect(find.text('Detalle de tarea'), findsOneWidget);
  });
}

http.Response _json(Object body) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), 200, headers: {'content-type': 'application/json'});

class _FakeApi {
  _FakeApi(this.routes);

  final Map<String, http.Response Function(http.Request request)> routes;

  late final client = MockClient((request) async {
    final path = request.url.path.replaceFirst('/api/v1', '');
    final handler = routes['${request.method} $path'];
    return handler?.call(request) ?? http.Response('{"message":"Ruta no simulada: $path"}', 404);
  });
}
