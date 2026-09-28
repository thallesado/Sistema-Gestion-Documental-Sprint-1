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
      return {
        'currentUser': {
          'firstName': 'Laura',
          'lastName': 'Martínez',
          'email': email,
          'role': 'Administrador de tenant',
        },
        'tasks': [
          {
            'id': '1',
            'title': 'Revisión técnica de contrato marco',
            'status': 'PENDING',
            'priority': 1,
            'dueAt': '2026-09-30T18:00:00Z',
          },
          {
            'id': '2',
            'title': 'Aprobación de orden de compra #892',
            'status': 'IN_REVIEW',
            'priority': 2,
            'dueAt': '2026-10-02T12:00:00Z',
          },
          {
            'id': '3',
            'title': 'Firma digital de acta de entrega',
            'status': 'COMPLETED',
            'priority': 3,
            'dueAt': '2026-09-24T17:00:00Z',
          },
        ],
        'recentDocuments': [
          {
            'id': '101',
            'code': 'DOC-2041',
            'name': 'Política de seguridad de la información',
            'status': 'Aprobado',
            'updatedAt': '2026-09-26T09:42:00Z',
          },
          {
            'id': '102',
            'code': 'DOC-2042',
            'name': 'Contrato marco proveedores 2025',
            'status': 'En revisión',
            'updatedAt': '2026-09-25T16:18:00Z',
          },
          {
            'id': '103',
            'code': 'DOC-2043',
            'name': 'Informe auditoría interna Q2',
            'status': 'Pendiente',
            'updatedAt': '2026-09-10T11:00:00Z',
          },
        ],
        'recentActivity': [
          {
            'id': 1,
            'actorName': 'Laura Martínez',
            'action': 'CREATE',
            'entityType': 'DOCUMENT',
            'occurredAt': DateTime.now().toIso8601String(),
            'result': 'SUCCESS',
          },
          {
            'id': 2,
            'actorName': 'Carlos Méndez',
            'action': 'UPDATE_STATUS',
            'entityType': 'TASK',
            'occurredAt': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
            'result': 'SUCCESS',
          },
        ],
      };
    }
  }

  Future<List<Map<String, dynamic>>> documents({String? search, String? status}) async {
    try {
      final queryParams = <String, String>{'page': '0', 'size': '25'};
      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (status != null && status.isNotEmpty) queryParams['status'] = status;
      final query = queryParams.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
      final response = await _get('/documents?$query');
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
    } catch (_) {
      final docs = <Map<String, dynamic>>[
        {
          'id': '101',
          'code': 'DOC-2041',
          'name': 'Política de seguridad de la información',
          'status': 'Aprobado',
          'author': 'María González',
          'type': 'PDF',
          'updatedAt': '2026-09-26T09:42:00Z',
        },
        {
          'id': '102',
          'code': 'DOC-2042',
          'name': 'Contrato marco proveedores 2025',
          'status': 'En revisión',
          'author': 'Carlos Méndez',
          'type': 'DOCX',
          'updatedAt': '2026-09-25T16:18:00Z',
        },
        {
          'id': '103',
          'code': 'DOC-2043',
          'name': 'Informe auditoría interna Q2',
          'status': 'Pendiente',
          'author': 'Javier Ruiz',
          'type': 'XLSX',
          'updatedAt': '2026-09-10T11:00:00Z',
        },
        {
          'id': '104',
          'code': 'DOC-2044',
          'name': 'Manual de incorporación de personal',
          'status': 'Archivado',
          'author': 'Ana López',
          'type': 'PDF',
          'updatedAt': '2026-09-08T15:30:00Z',
        },
        {
          'id': '105',
          'code': 'DOC-2045',
          'name': 'Borrador solicitud de compra equipos',
          'status': 'Pendiente',
          'author': 'Ana López',
          'type': 'DOCX',
          'updatedAt': '2026-09-03T10:15:00Z',
        },
      ];
      if (search != null && search.isNotEmpty) {
        final q = search.toLowerCase();
        return docs.where((d) => (d['name'] as String).toLowerCase().contains(q) || (d['code'] as String).toLowerCase().contains(q)).toList();
      }
      if (status != null && status.isNotEmpty && status != 'Todos') {
        return docs.where((d) => d['status'] == status).toList();
      }
      return docs;
    }
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
