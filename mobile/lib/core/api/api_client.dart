import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../constants/api_constants.dart';
import '../errors/api_exception.dart';

/// Cliente HTTP de NexoDocs: adjunta el token, renueva la sesión una vez ante un
/// 401 (igual que el interceptor de la web) y traduce los errores a [ApiException].
class ApiClient {
  ApiClient({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      storage = storage ?? const FlutterSecureStorage();

  static const accessTokenKey = 'access_token';
  static const refreshTokenKey = 'refresh_token';
  static const serverUrlKey = 'server_url';
  static const _timeout = Duration(seconds: 20);

  final http.Client _client;
  final FlutterSecureStorage storage;

  /// Se emite cuando la sesión no puede renovarse; la app vuelve al login.
  final ValueNotifier<int> sessionExpired = ValueNotifier(0);

  Future<bool>? _refreshing;

  Future<void> restoreServerUrl() async {
    final saved = await storage.read(key: serverUrlKey);
    if (saved != null && saved.isNotEmpty) apiBaseUrl = saved;
  }

  Future<void> saveServerUrl(String url) async {
    apiBaseUrl = url;
    await storage.write(key: serverUrlKey, value: apiBaseUrl);
  }

  Future<void> saveTokens(String token, String refreshToken) async {
    await storage.write(key: accessTokenKey, value: token);
    await storage.write(key: refreshTokenKey, value: refreshToken);
  }

  Future<void> clearSession() async {
    await storage.delete(key: accessTokenKey);
    await storage.delete(key: refreshTokenKey);
  }

  Future<bool> hasSession() async => (await storage.read(key: refreshTokenKey)) != null;

  Uri uri(String path, [Map<String, dynamic>? query]) {
    final params = <String, String>{};
    query?.forEach((key, value) {
      if (value == null) return;
      final text = value.toString();
      if (text.isNotEmpty) params[key] = text;
    });
    final base = Uri.parse('$apiBaseUrl$path');
    return params.isEmpty ? base : base.replace(queryParameters: {...base.queryParameters, ...params});
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      _decode(await _send(() => _client.get(uri(path, query), headers: _headers)));

  Future<dynamic> post(String path, [Object? body]) async =>
      _decode(await _send(() => _client.post(uri(path), headers: _jsonHeaders, body: jsonEncode(body ?? {}))));

  Future<dynamic> put(String path, [Object? body]) async =>
      _decode(await _send(() => _client.put(uri(path), headers: _jsonHeaders, body: jsonEncode(body ?? {}))));

  Future<dynamic> patch(String path, [Object? body]) async =>
      _decode(await _send(() => _client.patch(uri(path), headers: _jsonHeaders, body: jsonEncode(body ?? {}))));

  Future<Uint8List> getBytes(String path) async =>
      (await _send(() => _client.get(uri(path), headers: _headers))).bodyBytes;

  /// Petición sin sesión (login, organizaciones públicas, renovación).
  Future<dynamic> postPublic(String path, Object body) async {
    final response = await _guard(() => _client.post(uri(path), headers: {'Content-Type': 'application/json'}, body: jsonEncode(body)));
    _throwIfError(response);
    return _decode(response);
  }

  Future<dynamic> getPublic(String path) async {
    final response = await _guard(() => _client.get(uri(path)));
    _throwIfError(response);
    return _decode(response);
  }

  String? _token;
  Map<String, String> get _headers => {if (_token != null) 'Authorization': 'Bearer $_token'};
  Map<String, String> get _jsonHeaders => {..._headers, 'Content-Type': 'application/json'};

  Future<http.Response> _send(Future<http.Response> Function() request) async {
    _token = await storage.read(key: accessTokenKey);
    if (_token == null) throw await _expire();
    var response = await _guard(request);
    if (response.statusCode == 401) {
      if (!await _refresh()) throw await _expire();
      _token = await storage.read(key: accessTokenKey);
      response = await _guard(request);
      if (response.statusCode == 401) throw await _expire();
    }
    _throwIfError(response);
    return response;
  }

  /// Una sola renovación en curso aunque varias pantallas reciban 401 a la vez.
  Future<bool> _refresh() => _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<bool> _doRefresh() async {
    final refreshToken = await storage.read(key: refreshTokenKey);
    if (refreshToken == null) return false;
    try {
      final response = await _guard(() => _client.post(
        uri('/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      ));
      if (response.statusCode != 200) return false;
      final body = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final token = body['token'] as String?;
      final newRefresh = body['refreshToken'] as String?;
      if (token == null || newRefresh == null) return false;
      await saveTokens(token, newRefresh);
      return true;
    } on ApiException {
      return false;
    }
  }

  Future<SessionExpiredException> _expire() async {
    await clearSession();
    sessionExpired.value++;
    return const SessionExpiredException();
  }

  Future<http.Response> _guard(Future<http.Response> Function() request) async {
    try {
      return await request().timeout(_timeout);
    } on TimeoutException {
      throw const ApiException('El servidor tardó demasiado en responder. Inténtalo de nuevo.');
    } catch (_) {
      throw ApiException('No se pudo conectar con el servidor ($apiBaseUrl). Revisa tu conexión.');
    }
  }

  void _throwIfError(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    String? message;
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is Map && body['message'] is String) message = body['message'] as String;
    } catch (_) {}
    throw ApiException(message ?? _defaultMessage(response.statusCode), statusCode: response.statusCode);
  }

  static String _defaultMessage(int status) => switch (status) {
    400 => 'La solicitud no es válida.',
    403 => 'No tienes permisos para realizar esta acción.',
    404 => 'El recurso solicitado no existe.',
    409 => 'La operación entra en conflicto con el estado actual.',
    429 => 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.',
    _ => 'El servidor respondió con un error ($status).',
  };

  dynamic _decode(http.Response response) {
    if (response.bodyBytes.isEmpty) return null;
    return jsonDecode(utf8.decode(response.bodyBytes));
  }
}
