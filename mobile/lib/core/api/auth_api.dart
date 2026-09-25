import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';
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
    final response = await _client.post(
      Uri.parse('$apiBaseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'tenantId': tenantId,
        'usernameOrEmail': username,
        'password': password,
      }),
    );
    if (response.statusCode != 200) {
      throw AuthException(
        response.statusCode == 401
            ? 'Credenciales u organización inválidas.'
            : 'No fue posible iniciar sesión (${response.statusCode}).',
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
  }

  Future<List<Map<String, dynamic>>> patients(String filter) async {
    final response = await _get(
      '/patients?size=20&filter=${Uri.encodeQueryComponent(filter)}',
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> quickSummary(String patientId) async {
    final response = await _get('/patients/$patientId/quick-summary');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<http.Response> _get(String path) async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) throw const AuthException('La sesión móvil expiró.');
    final response = await _client.get(
      Uri.parse('$apiBaseUrl$path'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw AuthException('La consulta falló (${response.statusCode}).');
    }
    return response;
  }
}
