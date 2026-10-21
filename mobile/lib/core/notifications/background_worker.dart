import 'dart:convert';
import 'dart:ui';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:workmanager/workmanager.dart';

import '../api/api_client.dart';
import '../constants/api_constants.dart';
import 'workflow_notifications.dart';

/// Punto de entrada del trabajo periódico de Android (se ejecuta en un isolate aparte, sin UI).
///
/// Solo usa el token de acceso guardado y **nunca renueva la sesión**: el refresh token rota en
/// cada uso y una renovación en paralelo con la app abierta podría invalidar la sesión. Si el
/// token caducó, no avisa hasta que el usuario vuelva a abrir la app.
@pragma('vm:entry-point')
void notificationsCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    DartPluginRegistrant.ensureInitialized();
    try {
      await checkWorkflowNotificationsInBackground();
    } catch (_) {
      // Un fallo de red no debe reintentar en bucle: se volverá a comprobar en el siguiente ciclo.
    }
    return true;
  });
}

/// Consulta los avisos con el token guardado y muestra los nuevos. Devuelve cuántos avisó.
Future<int> checkWorkflowNotificationsInBackground({
  FlutterSecureStorage storage = const FlutterSecureStorage(),
  http.Client? client,
}) async {
  final token = await storage.read(key: ApiClient.accessTokenKey);
  if (token == null) return 0;
  final savedUrl = await storage.read(key: ApiClient.serverUrlKey);
  if (savedUrl != null && savedUrl.isNotEmpty) apiBaseUrl = savedUrl;

  final httpClient = client ?? http.Client();
  final response = await httpClient
      .get(Uri.parse('$apiBaseUrl/workflows/notifications?page=0&size=20'), headers: {'Authorization': 'Bearer $token'})
      .timeout(const Duration(seconds: 20));
  if (response.statusCode != 200) return 0;
  final body = jsonDecode(utf8.decode(response.bodyBytes));
  if (body is! Map || body['content'] is! List) return 0;
  final items = (body['content'] as List).whereType<Map<String, dynamic>>().toList();
  return WorkflowNotifications.instance.notifyNew(items, storage: storage);
}
