import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexodocs_mobile/core/errors/api_exception.dart';
import 'package:nexodocs_mobile/core/notifications/seen_notifications.dart';
import 'package:nexodocs_mobile/core/notifications/workflow_notifications.dart';
import 'package:nexodocs_mobile/core/push/push_messaging.dart';
import 'package:nexodocs_mobile/core/push/push_service.dart';

/// Cliente de FCM simulado: los tests emiten mensajes y tokens a mano.
class FakePushClient implements PushMessagingClient {
  FakePushClient({this.ready = true, this.permission = true, this.token = 'token-1'});

  bool ready;
  bool permission;
  String? token;
  PushMessage? initial;
  int initialCalls = 0;

  final tokenRefresh = StreamController<String>.broadcast();
  final foreground = StreamController<PushMessage>.broadcast();
  final opened = StreamController<PushMessage>.broadcast();

  @override
  Future<bool> initialize() async => ready;

  @override
  Future<bool> requestPermission() async => permission;

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => tokenRefresh.stream;

  @override
  Stream<PushMessage> get onForegroundMessage => foreground.stream;

  @override
  Stream<PushMessage> get onOpenedApp => opened.stream;

  @override
  Future<PushMessage?> initialMessage() async {
    initialCalls++;
    return initial;
  }

  Future<void> close() async {
    await tokenRefresh.close();
    await foreground.close();
    await opened.close();
  }
}

/// Registro HTTP simulado: guarda las llamadas en orden.
class FakeRegistry implements PushTokenRegistry {
  final calls = <String>[];
  bool rejectWith409 = false;

  @override
  Future<void> register(String token) async {
    if (rejectWith409) throw const ApiException('Este dispositivo ya está registrado', statusCode: 409);
    calls.add('POST $token');
  }

  @override
  Future<void> unregister(String token) async => calls.add('DELETE $token');
}

/// Presentador simulado: registra qué se mostró y qué tarea se abrió.
class FakePresenter implements PushPresenter {
  final shown = <String?>[];
  final opened = <String>[];
  final queued = <String>[];

  @override
  Future<void> showIncoming({required String? notificationId, required String title, required String body, String? taskId}) async {
    shown.add(notificationId);
  }

  @override
  void openTask(String taskId) => opened.add(taskId);

  @override
  void queueTask(String taskId) => queued.add(taskId);
}

PushMessage taskPush({String notificationId = 'n-1', String taskId = 't-1'}) => PushMessage(
  title: 'Nueva tarea asignada',
  body: 'Abre NexoDocs para ver los detalles.',
  data: {'notificationId': notificationId, 'taskId': taskId},
);

/// Espera a que se procesen los eventos de los streams y las promesas pendientes.
Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 10));

void main() {
  late FakePushClient client;
  late FakeRegistry registry;
  late FakePresenter presenter;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    client = FakePushClient();
    registry = FakeRegistry();
    presenter = FakePresenter();
  });

  tearDown(() async {
    await client.close();
  });

  PushService service({SeenNotifications? seen}) => PushService(
    client: client,
    presenter: presenter,
    seen: seen ?? SeenNotifications(),
  );

  group('sin Firebase configurado', () {
    test('la app sigue funcionando: sin registro ni escucha', () async {
      client.ready = false;
      final push = service();

      await push.prepare();
      await push.start(registry);
      await push.unregister(registry: registry);

      expect(push.enabled, isFalse);
      expect(registry.calls, isEmpty);
      expect(presenter.queued, isEmpty);
    });
  });

  group('registro del token', () {
    test('tras iniciar sesión se pide permiso y se registra el token ANDROID', () async {
      final push = service();
      await push.prepare();
      await push.start(registry);

      expect(registry.calls, ['POST token-1']);
      await push.unregister(registry: registry);
    });

    test('sin permiso no se registra nada', () async {
      client.permission = false;
      final push = service();
      await push.prepare();
      await push.start(registry);

      expect(registry.calls, isEmpty);
      await push.unregister(registry: registry);
    });

    test('al renovar el token se registra el nuevo y se borra el anterior', () async {
      final push = service();
      await push.prepare();
      await push.start(registry);

      client.tokenRefresh.add('token-2');
      await settle();

      expect(registry.calls, ['POST token-1', 'POST token-2', 'DELETE token-1']);
      await push.unregister(registry: registry);
    });

    test('un 409 (token de otra cuenta) no rompe la app', () async {
      registry.rejectWith409 = true;
      final push = service();
      await push.prepare();
      await expectLater(push.start(registry), completes);
      await push.unregister(registry: registry);
    });
  });

  group('cierre de sesión', () {
    test('borra el token del servidor una sola vez', () async {
      final push = service();
      await push.prepare();
      await push.start(registry);

      await push.unregister(registry: registry);
      await push.unregister(registry: registry);

      expect(registry.calls, ['POST token-1', 'DELETE token-1']);
    });

    test('sin sesión activa en esta ejecución no llama al servidor', () async {
      final push = service();
      await push.prepare();

      await push.unregister(registry: registry);

      expect(registry.calls, isEmpty);
    });

    test('con sesión activa pero sin token registrado, consulta el token de FCM antes de borrarlo', () async {
      // El registro fue rechazado (409): no hay token guardado en memoria.
      registry.rejectWith409 = true;
      final push = service();
      await push.prepare();
      await push.start(registry);
      registry.rejectWith409 = false;

      await push.unregister(registry: registry);

      expect(registry.calls, ['DELETE token-1']);
    });
  });

  group('avisos con la app abierta', () {
    test('se muestran una sola vez aunque lleguen dos veces (mismo notificationId)', () async {
      final push = service();
      await push.prepare();
      await push.start(registry);

      client.foreground.add(taskPush(notificationId: 'n-7'));
      client.foreground.add(taskPush(notificationId: 'n-7'));
      await settle();

      expect(presenter.shown, ['n-7']);
      await push.unregister(registry: registry);
    });

    test('un aviso que el sondeo ya mostró no se repite por push', () async {
      final seen = SeenNotifications();
      await seen.markSeen('n-9');
      final push = service(seen: seen);
      await push.prepare();
      await push.start(registry);

      client.foreground.add(taskPush(notificationId: 'n-9'));
      await settle();

      expect(presenter.shown, isEmpty);
      await push.unregister(registry: registry);
    });
  });

  group('tocar un aviso', () {
    test('con la app en segundo plano abre la tarea indicada', () async {
      final push = service();
      await push.prepare();
      await push.start(registry);

      client.opened.add(taskPush(taskId: 'tarea-42'));
      await settle();

      expect(presenter.opened, ['tarea-42']);
      await push.unregister(registry: registry);
    });

    test('con la app cerrada se encola la tarea una sola vez por ejecución', () async {
      client.initial = taskPush(taskId: 'tarea-77');
      final push = service();
      await push.prepare();
      await push.start(registry);
      await push.start(registry);

      expect(presenter.queued, ['tarea-77']);
      expect(client.initialCalls, 1);
      await push.unregister(registry: registry);
    });
  });

  group('marca de vistos en segundo plano', () {
    test('el aislado de segundo plano marca el aviso para que el sondeo no lo repita', () async {
      final seen = SeenNotifications();

      await markPushSeen({'notificationId': 'n-bg', 'taskId': 't-1'}, seen);

      expect(await seen.markSeen('n-bg'), isFalse);
    });

    test('un mensaje sin notificationId no marca nada', () async {
      final seen = SeenNotifications();
      await markPushSeen({'taskId': 't-1'}, seen);
      expect(await seen.seenIds(), isEmpty);
    });
  });

  group('SeenNotifications', () {
    test('markSeen devuelve false a la segunda vez', () async {
      final seen = SeenNotifications();
      expect(await seen.markSeen('a'), isTrue);
      expect(await seen.markSeen('a'), isFalse);
    });

    test('conserva solo los últimos 200 identificadores', () async {
      final seen = SeenNotifications();
      for (var i = 0; i < SeenNotifications.maxIds + 5; i++) {
        await seen.markSeen('id-$i');
      }
      final ids = await seen.seenIds();
      expect(ids.length, SeenNotifications.maxIds);
      expect(ids.contains('id-0'), isFalse);
      expect(ids.contains('id-${SeenNotifications.maxIds + 4}'), isTrue);
    });

    test('un valor dañado no impide mostrar avisos', () async {
      FlutterSecureStorage.setMockInitialValues({SeenNotifications.storageKey: '{no es json'});
      final seen = SeenNotifications();
      expect(await seen.markSeen('x'), isTrue);
    });
  });

  group('dropSeen (sondeo)', () {
    test('descarta los avisos ya vistos y conserva el resto', () {
      final items = [
        {'id': 'a', 'title': 'uno'},
        {'id': 'b', 'title': 'dos'},
      ];
      expect(dropSeen(items, {'a'}), [
        {'id': 'b', 'title': 'dos'},
      ]);
    });
  });

  group('PushMessage', () {
    test('ignora identificadores vacíos', () {
      const message = PushMessage(data: {'notificationId': '', 'taskId': ''});
      expect(message.notificationId, isNull);
      expect(message.taskId, isNull);
    });
  });
}
