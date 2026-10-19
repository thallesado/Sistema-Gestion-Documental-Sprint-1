import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:workmanager/workmanager.dart';

import 'background_worker.dart';

/// Avisos de workflow como notificaciones del sistema.
///
/// No usa servicios externos (Firebase): la app consulta `GET /workflows/notifications`
/// mientras está abierta y, en Android, un trabajo periódico de WorkManager lo hace con la app
/// cerrada (el sistema lo ejecuta como mínimo cada 15 minutos y solo con red).
/// Primer plano y segundo plano comparten la marca [seenUntilKey] para no avisar dos veces.
class WorkflowNotifications {
  WorkflowNotifications._();

  static final instance = WorkflowNotifications._();

  static const seenUntilKey = 'notifications_seen_until';
  static const periodicTaskName = 'nexodocs-workflow-notifications';
  static const _channelId = 'workflow_tasks';
  static const _channelName = 'Tareas de workflow';
  static const _maxPerBatch = 5;

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  /// Tarea pendiente de abrir cuando la app se lanzó tocando una notificación.
  String? _pendingTaskId;

  /// La registra el shell: abre el detalle de la tarea al tocar una notificación.
  void Function(String taskId)? onOpenTask;

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
      final launch = await _plugin.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) {
        final payload = launch!.notificationResponse?.payload;
        if (payload != null && payload.isNotEmpty) _pendingTaskId = payload;
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
    final fresh = unreadSince(items, marker);
    if (fresh.isEmpty) return 0;
    await init();
    if (!_initialized) return 0;
    for (final item in fresh.take(_maxPerBatch)) {
      await _show(item);
    }
    if (fresh.length > _maxPerBatch) {
      await _plugin.show(
        id: 0,
        title: 'NexoDocs',
        body: 'Tienes ${fresh.length - _maxPerBatch} avisos más pendientes.',
        notificationDetails: _details,
      );
    }
    return fresh.length;
  }

  Future<void> _show(Map<String, dynamic> item) => _plugin.show(
    id: (item['id']?.toString() ?? '').hashCode & 0x7fffffff,
    title: item['title'] as String? ?? 'Aviso de NexoDocs',
    body: item['message'] as String? ?? '',
    notificationDetails: _details,
    payload: item['related_entity_type'] == 'workflow_task' ? item['related_entity_id'] as String? : null,
  );

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: 'Tareas asignadas, devoluciones y vencimientos de workflows',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(),
  );

  void _open(String? taskId) {
    if (taskId == null || taskId.isEmpty) return;
    final handler = onOpenTask;
    if (handler != null) {
      handler(taskId);
    } else {
      _pendingTaskId = taskId;
    }
  }
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

@visibleForTesting
DateTime? newestCreatedAt(List<Map<String, dynamic>> items) {
  DateTime? newest;
  for (final item in items) {
    final created = DateTime.tryParse(item['created_at']?.toString() ?? '');
    if (created != null && (newest == null || created.isAfter(newest))) newest = created;
  }
  return newest;
}
