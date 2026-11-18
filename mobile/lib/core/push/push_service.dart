import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../errors/api_exception.dart';
import '../notifications/seen_notifications.dart';
import '../notifications/workflow_notifications.dart';
import 'push_messaging.dart';

/// Registro del token del dispositivo en el servidor (`/push-tokens`).
abstract interface class PushTokenRegistry {
  Future<void> register(String token);

  Future<void> unregister(String token);
}

/// Registro por HTTP con la sesión del usuario.
class ApiPushTokenRegistry implements PushTokenRegistry {
  ApiPushTokenRegistry(this.client);

  final ApiClient client;

  static const platform = 'ANDROID';

  @override
  Future<void> register(String token) async {
    await client.post('/push-tokens', {'token': token, 'platform': platform});
  }

  @override
  Future<void> unregister(String token) async {
    await client.delete('/push-tokens/${Uri.encodeComponent(token)}');
  }
}

/// Avisos push: registro del token tras iniciar sesión, avisos con la app abierta, apertura de tareas
/// y baja al cerrar sesión.
///
/// Si Firebase no está configurado, todo queda inactivo y la app funciona como antes (sondeo y WorkManager).
/// Nunca lanza excepciones hacia la interfaz: los fallos de red o de registro se registran y se reintentan
/// en el siguiente inicio de sesión o cuando FCM renueve el token.
class PushService {
  PushService({PushMessagingClient? client, required PushPresenter presenter, SeenNotifications? seen})
    : _client = client ?? FirebasePushMessagingClient(),
      _presenter = presenter,
      _seen = seen ?? SeenNotifications.instance;

  static final instance = PushService(presenter: WorkflowNotifications.instance);

  final PushMessagingClient _client;
  final PushPresenter _presenter;
  final SeenNotifications _seen;

  bool _prepared = false;
  bool _enabled = false;
  /// Hay una sesión con avisos push activos en esta ejecución (entre [start] y [unregister]).
  bool _active = false;
  bool _initialHandled = false;
  PushTokenRegistry? _registry;
  String? _token;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  /// true si Firebase está configurado y la app puede recibir avisos push.
  bool get enabled => _enabled;

  /// Al abrir la app, antes de cualquier sesión: inicializa Firebase y el aislado de segundo plano.
  Future<void> prepare() async {
    if (_prepared) return;
    _prepared = true;
    _enabled = await _client.initialize();
  }

  /// Tras iniciar sesión o restaurarla: pide permiso, registra el token y empieza a escuchar.
  Future<void> start(PushTokenRegistry registry) async {
    if (!_prepared) await prepare();
    if (!_enabled) return;
    _active = true;
    _registry = registry;
    if (_subscriptions.isEmpty) _listen();
    try {
      if (!await _client.requestPermission()) return;
      final token = await _client.getToken();
      if (token != null) await _register(token);
      if (!_initialHandled) {
        // Solo una vez por ejecución: si la app se abrió tocando un aviso, se abre esa tarea.
        _initialHandled = true;
        final taskId = (await _client.initialMessage())?.taskId;
        if (taskId != null) _presenter.queueTask(taskId);
      }
    } catch (error) {
      debugPrint('Avisos push: no se pudo completar el registro ($error)');
    }
  }

  /// Cierre de sesión: borra el token del servidor (antes de revocar la sesión) y deja de escuchar.
  Future<void> unregister({PushTokenRegistry? registry}) async {
    final target = registry ?? _registry;
    String? token = _token;
    if (token == null && _active) token = await _currentToken();
    if (target != null && token != null) {
      try {
        await target.unregister(token);
      } on ApiException catch (error) {
        debugPrint('Avisos push: no se pudo borrar el token del servidor (${error.statusCode})');
      }
    }
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
    _token = null;
    _registry = null;
    _active = false;
    try {
      await _seen.clear();
    } catch (_) {
      // Sin almacenamiento seguro no hay nada que borrar.
    }
  }

  void _listen() {
    _subscriptions
      ..add(_client.onTokenRefresh.listen(_register))
      ..add(_client.onForegroundMessage.listen(_onForeground))
      ..add(_client.onOpenedApp.listen(_onOpened));
  }

  Future<void> _register(String token) async {
    final registry = _registry;
    if (registry == null) return;
    final previous = _token;
    try {
      await registry.register(token);
      _token = token;
    } on ApiException catch (error) {
      // Un 409 indica que el token pertenece a otra cuenta del dispositivo: se reintenta más tarde.
      debugPrint('Avisos push: registro no aceptado (${error.statusCode})');
      return;
    }
    if (previous != null && previous != token) {
      try {
        await registry.unregister(previous);
      } on ApiException {
        // El token anterior caduca solo en el servidor si FCM lo invalida.
      }
    }
  }

  Future<void> _onForeground(PushMessage message) async {
    final id = message.notificationId;
    // El sondeo o un push anterior pudieron mostrarlo ya: no se repite.
    if (id != null && !await _seen.markSeen(id)) return;
    await _presenter.showIncoming(
      notificationId: id,
      title: message.title ?? 'NexoDocs',
      body: message.body ?? '',
      taskId: message.taskId,
    );
  }

  void _onOpened(PushMessage message) {
    final taskId = message.taskId;
    if (taskId != null) _presenter.openTask(taskId);
  }

  Future<String?> _currentToken() async {
    try {
      return await _client.getToken();
    } catch (_) {
      return null;
    }
  }
}
