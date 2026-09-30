import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';
import '../data/mock_dashboard_data.dart';
import '../errors/auth_exception.dart';

class AuthApi {
  AuthApi({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;

  Future<void> login({
    required String tenantId,
    required String username,
    required String password,
  }) async {
    final payload = jsonEncode({
      if (tenantId.trim().isNotEmpty) 'tenantId': tenantId.trim(),
      'usernameOrEmail': username.trim(),
      'password': password,
    });

    http.Response response;
    try {
      response = await _client.post(
        Uri.parse('$apiBaseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: payload,
      ).timeout(const Duration(seconds: 8));
    } catch (primaryErr) {
      final fallbackUrl = apiBaseUrl.contains('127.0.0.1') || apiBaseUrl.contains('localhost')
          ? 'http://192.168.100.37:8080/api/v1'
          : 'http://127.0.0.1:8080/api/v1';
      try {
        response = await _client.post(
          Uri.parse('$fallbackUrl/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: payload,
        ).timeout(const Duration(seconds: 8));
        apiBaseUrl = fallbackUrl;
      } catch (fallbackErr) {
        throw AuthException(
          'No se pudo conectar al servidor.\nIntentó: $apiBaseUrl y $fallbackUrl\nVerifica que el backend esté activo.',
        );
      }
    }

    if (response.statusCode != 200) {
      String msg = 'No fue posible iniciar sesión (${response.statusCode}).';
      try {
        final errJson = jsonDecode(response.body);
        if (errJson is Map && errJson['message'] != null) {
          msg = errJson['message'].toString();
        }
      } catch (_) {}
      throw AuthException(
        response.statusCode == 401
            ? 'Credenciales u organización inválidas.'
            : msg,
      );
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final token = body['token'] as String?;
    final refreshToken = body['refreshToken'] as String?;
    if (token == null || refreshToken == null) {
      throw const AuthException('Respuesta de sesión incompleta.');
    }
    await _storage.write(key: 'access_token', value: token);
    await _storage.write(key: 'refresh_token', value: refreshToken);
    await _storage.write(key: 'tenant_id', value: tenantId);
    await _storage.write(key: 'user_email', value: username);
  }

  Future<void> logout() async {
    await _storage.deleteAll();
  }

  Future<String?> getTenantId() async => await _storage.read(key: 'tenant_id');
  Future<String?> getUserEmail() async => await _storage.read(key: 'user_email');
  Future<String?> getAccessToken() async => await _storage.read(key: 'access_token');

  Future<Map<String, dynamic>> dashboard() async {
    try {
      final response = await _get('/dashboard?limit=10');
      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      final email = await getUserEmail() ?? 'laura@acme.com';
      return getMockDashboardData(email);
    }
  }

  Future<http.Response> _get(String path) async {
    final token = await getAccessToken();
    final tenantId = await getTenantId();
    final headers = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (tenantId != null && tenantId.isNotEmpty) 'X-Tenant-ID': tenantId,
    };
    return _client.get(Uri.parse('$apiBaseUrl$path'), headers: headers).timeout(const Duration(seconds: 8));
  }
}
