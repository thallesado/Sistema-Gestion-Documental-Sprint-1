import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../notifications/seen_notifications.dart';

/// Mensaje de FCM sin tipos del plugin, para poder simularlo en las pruebas.
class PushMessage {
  const PushMessage({this.title, this.body, this.data = const {}});

  final String? title;
  final String? body;
  final Map<String, String> data;

  /// Identificador del aviso en el servidor (`notifications.id`).
  String? get notificationId => _nonEmpty(data['notificationId']);

  /// Tarea a abrir al tocar el aviso.
  String? get taskId => _nonEmpty(data['taskId']);

  static String? _nonEmpty(String? value) => value == null || value.isEmpty ? null : value;
}

/// Acceso a Firebase Cloud Messaging. La app depende de esta interfaz y las pruebas la sustituyen.
abstract interface class PushMessagingClient {
  /// false si Firebase no está configurado (sin google-services.json): no habrá avisos push.
  Future<bool> initialize();

  /// true si el usuario permite notificaciones (en Android 13 o superior pide POST_NOTIFICATIONS).
  Future<bool> requestPermission();

  Future<String?> getToken();

  Stream<String> get onTokenRefresh;

  /// Mensajes con la app en primer plano: el sistema no los muestra por sí solo.
  Stream<PushMessage> get onForegroundMessage;

  /// El usuario tocó un aviso con la app en segundo plano.
  Stream<PushMessage> get onOpenedApp;

  /// Mensaje que abrió la app estando cerrada, o null.
  Future<PushMessage?> initialMessage();
}

/// Lo que los avisos push necesitan de la interfaz de la app: mostrar avisos y abrir tareas.
/// Lo implementa `WorkflowNotifications`; las pruebas usan un doble.
abstract interface class PushPresenter {
  /// Muestra el aviso como notificación del sistema (app en primer plano).
  Future<void> showIncoming({
    required String? notificationId,
    required String title,
    required String body,
    String? taskId,
  });

  /// Abre la tarea ahora (la app estaba en segundo plano).
  void openTask(String taskId);

  /// Guarda la tarea para abrirla cuando la pantalla principal esté lista (app cerrada).
  void queueTask(String taskId);
}

/// Implementación con firebase_messaging. Solo funciona si Firebase está configurado en el dispositivo.
class FirebasePushMessagingClient implements PushMessagingClient {
  @override
  Future<bool> initialize() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundMessageHandler);
      return true;
    } catch (error) {
      debugPrint('Avisos push desactivados: Firebase no está configurado ($error)');
      return false;
    }
  }

  @override
  Future<bool> requestPermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  // El backend envía con el token de registro FCM (Admin SDK, Message.token). Las APIs que lo
  // devuelven están marcadas como obsoletas en firebase_messaging 17 en favor del ID de instalación
  // (envío directo), que es otro identificador: migrar exige cambiar también el envío del servidor.
  @override
  // ignore: deprecated_member_use
  Future<String?> getToken() => FirebaseMessaging.instance.getToken();

  @override
  // ignore: deprecated_member_use
  Stream<String> get onTokenRefresh => FirebaseMessaging.instance.onTokenRefresh;

  @override
  Stream<PushMessage> get onForegroundMessage => FirebaseMessaging.onMessage.map(_fromRemote);

  @override
  Stream<PushMessage> get onOpenedApp => FirebaseMessaging.onMessageOpenedApp.map(_fromRemote);

  @override
  Future<PushMessage?> initialMessage() async {
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return message == null ? null : _fromRemote(message);
  }

  static PushMessage _fromRemote(RemoteMessage message) => PushMessage(
    title: message.notification?.title,
    body: message.notification?.body,
    data: message.data.map((key, value) => MapEntry(key, value.toString())),
  );
}

/// Aislado de segundo plano (app en segundo plano o cerrada). El mensaje lleva un bloque `notification`,
/// así que el sistema lo muestra solo; aquí únicamente se marca como visto para que el sondeo no lo repita.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundMessageHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Ya inicializado en este aislado.
  }
  await markPushSeen(message.data, SeenNotifications.instance);
}

/// Marca como visto el aviso indicado en los datos del mensaje.
Future<void> markPushSeen(Map<String, dynamic> data, SeenNotifications seen) async {
  final id = data['notificationId']?.toString();
  if (id != null && id.isNotEmpty) await seen.markSeen(id);
}
