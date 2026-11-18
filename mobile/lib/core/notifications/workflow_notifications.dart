import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:workmanager/workmanager.dart';

import '../i18n/app_language.dart';
import '../push/push_messaging.dart';
import 'seen_notifications.dart';
import 'background_worker.dart';

/// Avisos de workflow como notificaciones del sistema.
///
/// Dos vías: los avisos push de FCM (ver `core/push`), cuando Firebase está configurado, y el sondeo
/// de `GET /workflows/notifications` (con la app abierta, y en Android con WorkManager cerrada: como
/// mínimo cada 15 minutos y solo con red). El sondeo es el respaldo y nunca se elimina.
/// Ambas vías comparten [SeenNotifications]: cada aviso se muestra una sola vez.
/// La marca temporal [seenUntilKey] sigue sirviendo para no avisar de lo antiguo al iniciar sesión.
class WorkflowNotifications implements PushPresenter {
  WorkflowNotifications._();

  static final instance = WorkflowNotifications._();

  static const seenUntilKey = 'notifications_seen_until';
  static const periodicTaskName = 'nexodocs-workflow-notifications';
  /// Canal de Android de los avisos de tareas. El servidor lo nombra en cada push (`android.channelId`).
  static const channelId = 'workflow_tasks';
  static const _channelName = 'Tareas de workflow';
  static const _maxPerBatch = 5;

  final _plugin = FlutterLocalNotificationsPlugin();
  final _seen = SeenNotifications.instance;
  bool _initialized = false;

  /// Tarea o trámite pendiente de abrir cuando la app se lanzó tocando una notificación.
  String? _pendingTaskId;
  String? _pendingWorkflowId;

  /// La registra el shell: abre el detalle de la tarea al tocar una notificación.
  void Function(String taskId)? onOpenTask;

  /// La registra el shell: abre el trámite cuando el aviso es del flujo, no de una tarea.
  void Function(String workflowId)? onOpenWorkflow;

  Future<void> init() async {
    if (_initialized) return;
    try {
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
        onDidReceiveNotificationResponse: (response) => _open(response.payload),
      );
      // Los avisos push del servidor usan este canal: debe existir antes de que llegue el primero.
      await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(
        const AndroidNotificationChannel(
          channelId,
          _channelName,
          description: 'Tareas asignadas, devoluciones y vencimientos de workflows',
          importance: Importance.high,
        ),
      );
      final launch = await _plugin.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) {
        _rememberPending(launch!.notificationResponse?.payload);
      }
      _initialized = true;
    } catch (error) {
      // Sin plugin (pruebas, plataforma no soportada): la app funciona sin avisos del sistema.
      debugPrint('Notificaciones locales no disponibles: $error');
    }
  }

  /// Tarea que abrió la app desde una notificación (se entrega una sola vez).
  String? takePendingTask() {
    final taskId = _pendingTaskId;
    _pendingTaskId = null;
    return taskId;
  }

  /// Trámite que abrió la app desde una notificación (se entrega una sola vez).
  String? takePendingWorkflow() {
    final workflowId = _pendingWorkflowId;
    _pendingWorkflowId = null;
    return workflowId;
  }

  void _rememberPending(String? payload) {
    final destination = parseNotificationPayload(payload);
    if (destination == null) return;
    if (destination.kind == 'workflow') {
      _pendingWorkflowId = destination.id;
    } else {
      _pendingTaskId = destination.id;
    }
  }

  @override
  Future<void> showIncoming({
    required String? notificationId,
    required String title,
    required String body,
    String? taskId,
  }) async {
    await init();
    if (!_initialized) return;
    await _plugin.show(
      id: (notificationId ?? '${DateTime.now().microsecondsSinceEpoch}').hashCode & 0x7fffffff,
      title: title,
      body: body,
      notificationDetails: _details,
      payload: taskId,
    );
  }

  @override
  void openTask(String taskId) => _open(taskId);

  @override
  void queueTask(String taskId) {
    if (taskId.isNotEmpty) _pendingTaskId = taskId;
  }

  /// Tras iniciar sesión: pide permiso de notificaciones y programa la comprobación periódica.
  Future<void> start() async {
    await init();
    try {
      await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
      await _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      if (!kIsWeb && Platform.isAndroid) {
        await Workmanager().initialize(notificationsCallbackDispatcher);
        await Workmanager().registerPeriodicTask(
          periodicTaskName,
          periodicTaskName,
          frequency: const Duration(minutes: 15),
          constraints: Constraints(networkType: NetworkType.connected),
          existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
        );
      }
    } catch (error) {
      debugPrint('No se pudo programar la comprobación de avisos: $error');
    }
  }

  /// Al cerrar sesión: no se vuelve a consultar el servidor ni se avisa a otro usuario.
  Future<void> stop({FlutterSecureStorage storage = const FlutterSecureStorage()}) async {
    try {
      if (!kIsWeb && Platform.isAndroid) await Workmanager().cancelByUniqueName(periodicTaskName);
      await _plugin.cancelAll();
    } catch (_) {
      // Sin plugin no hay nada que cancelar.
    }
    await storage.delete(key: seenUntilKey);
  }

  /// Muestra como notificación del sistema los avisos no leídos que aún no se habían avisado.
  /// La primera vez solo guarda la marca, para no inundar al usuario con avisos antiguos.
  Future<int> notifyNew(List<Map<String, dynamic>> items, {FlutterSecureStorage storage = const FlutterSecureStorage()}) async {
    final marker = DateTime.tryParse(await storage.read(key: seenUntilKey) ?? '');
    final newest = newestCreatedAt(items);
    if (newest != null && (marker == null || newest.isAfter(marker))) {
      await storage.write(key: seenUntilKey, value: newest.toUtc().toIso8601String());
    }
    if (marker == null) return 0;
    // Descartados los avisos que ya salieron por push o en una comprobación anterior.
    final fresh = dropSeen(unreadSince(items, marker), await _seen.seenIds());
    if (fresh.isEmpty) return 0;
    await init();
    if (!_initialized) return 0;
    for (final item in fresh.take(_maxPerBatch)) {
      final id = item['id']?.toString();
      if (id != null && !await _seen.markSeen(id)) continue;
      await _show(item);
    }
    if (fresh.length > _maxPerBatch) {
      await _plugin.show(
        id: 0,
        title: 'NexoDocs',
        body: tr('Tienes {count} avisos más pendientes.', {'count': fresh.length - _maxPerBatch}),
        notificationDetails: _details,
      );
    }
    return fresh.length;
  }

  Future<void> _show(Map<String, dynamic> item) => _plugin.show(
    id: (item['id']?.toString() ?? '').hashCode & 0x7fffffff,
    title: item['title'] as String? ?? tr('Aviso de NexoDocs'),
    body: item['message'] as String? ?? '',
    notificationDetails: _details,
    payload: notificationPayload(item),
  );

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      channelId,
      _channelName,
      channelDescription: 'Tareas asignadas, devoluciones y vencimientos de workflows',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(),
  );

  void _open(String? payload) {
    final destination = parseNotificationPayload(payload);
    if (destination == null) return;
    if (destination.kind == 'workflow') {
      final handler = onOpenWorkflow;
      if (handler != null) {
        handler(destination.id);
      } else {
        _pendingWorkflowId = destination.id;
      }
      return;
    }
    final handler = onOpenTask;
    if (handler != null) {
      handler(destination.id);
    } else {
      _pendingTaskId = destination.id;
    }
  }
}

/// Destino al tocar un aviso. El motor guarda el flujo como `workflow`; la tarea, como `workflow_task`.
@visibleForTesting
({String kind, String id})? notificationDestination(Map<String, dynamic> item) {
  final id = item['related_entity_id']?.toString();
  if (id == null || id.isEmpty) return null;
  return switch (item['related_entity_type']) {
    'workflow_task' => (kind: 'task', id: id),
    'workflow' => (kind: 'workflow', id: id),
    _ => null,
  };
}

/// Carga de la notificación del sistema. La tarea sigue siendo el id pelado, compatible con el push.
@visibleForTesting
String? notificationPayload(Map<String, dynamic> item) {
  final destination = notificationDestination(item);
  if (destination == null) return null;
  return destination.kind == 'workflow' ? 'workflow:${destination.id}' : destination.id;
}

/// Interpreta la carga. Un id sin prefijo es una tarea, como los push que ya traen `taskId`.
@visibleForTesting
({String kind, String id})? parseNotificationPayload(String? payload) {
  if (payload == null || payload.isEmpty) return null;
  const prefix = 'workflow:';
  if (payload.startsWith(prefix)) {
    final id = payload.substring(prefix.length);
    if (id.isEmpty) return null;
    return (kind: 'workflow', id: id);
  }
  return (kind: 'task', id: payload);
}

/// Avisos no leídos creados después de [marker], del más antiguo al más reciente.
@visibleForTesting
List<Map<String, dynamic>> unreadSince(List<Map<String, dynamic>> items, DateTime marker) {
  final fresh = items.where((item) {
    if (item['is_read'] == true) return false;
    final created = DateTime.tryParse(item['created_at']?.toString() ?? '');
    return created != null && created.isAfter(marker);
  }).toList();
  fresh.sort((a, b) => a['created_at'].toString().compareTo(b['created_at'].toString()));
  return fresh;
}

/// Quita los avisos cuyo identificador ya está en [seen] (evita mostrar dos veces el mismo aviso).
@visibleForTesting
List<Map<String, dynamic>> dropSeen(List<Map<String, dynamic>> items, Set<String> seen) =>
    items.where((item) => !seen.contains(item['id']?.toString())).toList();

@visibleForTesting
DateTime? newestCreatedAt(List<Map<String, dynamic>> items) {
  DateTime? newest;
  for (final item in items) {
    final created = DateTime.tryParse(item['created_at']?.toString() ?? '');
    if (created != null && (newest == null || created.isAfter(newest))) newest = created;
  }
  return newest;
}
