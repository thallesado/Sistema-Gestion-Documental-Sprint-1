import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../errors/api_exception.dart';
import 'api_client.dart';
import 'clinical_api.dart';
import 'documents_api.dart';
import 'workflows_api.dart';

/// Organización seleccionable en el login (GET /tenants/public).
class PublicTenant {
  const PublicTenant(this.id, this.name);
  final String id;
  final String name;
}

/// Punto de entrada de la app: sesión y acceso a los servicios de cada módulo.
class AuthApi {
  AuthApi({http.Client? client, FlutterSecureStorage? storage})
    : client = ApiClient(client: client, storage: storage);

  final ApiClient client;

  late final documents = DocumentsApi(client);
  late final workflows = WorkflowsApi(client);
  late final clinical = ClinicalApi(client);

  Future<List<PublicTenant>> publicTenants() async {
    final list = await client.getPublic('/tenants/public') as List<dynamic>;
    return list
        .cast<Map<String, dynamic>>()
        .map((t) => PublicTenant(t['id'] as String, t['name'] as String? ?? ''))
        .toList();
  }

  /// [tenantId] vacío = administrador de plataforma (sin organización).
  Future<void> login({required String tenantId, required String username, required String password}) async {
    final Map<String, dynamic> body;
    try {
      body = await client.postPublic('/auth/login', {
        if (tenantId.trim().isNotEmpty) 'tenantId': tenantId.trim(),
        'usernameOrEmail': username.trim(),
        'password': password,
      }) as Map<String, dynamic>;
    } on ApiException catch (error) {
      if (error.statusCode == 401) throw const ApiException('Credenciales u organización inválidas.', statusCode: 401);
      rethrow;
    }
    final token = body['token'] as String?;
    final refreshToken = body['refreshToken'] as String?;
    if (token == null || refreshToken == null) throw const ApiException('Respuesta de sesión incompleta.');
    await client.saveTokens(token, refreshToken);
  }

  /// Cierra la sesión también en el servidor (revoca el refresh token), como la web.
  Future<void> logout() async {
    final refreshToken = await client.storage.read(key: ApiClient.refreshTokenKey);
    if (refreshToken != null) {
      try {
        await client.post('/auth/logout', {'refreshToken': refreshToken});
      } on ApiException {
        // La sesión local se elimina igualmente.
      }
    }
    await client.clearSession();
  }

  Future<Map<String, dynamic>> me() async => await client.get('/auth/me') as Map<String, dynamic>;

  Future<Map<String, dynamic>> dashboard() async =>
      await client.get('/dashboard', query: {'limit': 10}) as Map<String, dynamic>;
}
