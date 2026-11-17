import '../errors/api_exception.dart';
import 'api_client.dart';

/// Adaptador HTTP para los contratos de autenticación del backend.
class AuthRepository {
  const AuthRepository(this.client);
  final ApiClient client;

  Future<Map<String, dynamic>> login({required String tenantId, required String username, required String password}) async =>
      _session(await client.postPublic('/auth/login', {
        if (tenantId.trim().isNotEmpty) 'tenantId': tenantId.trim(),
        'usernameOrEmail': username.trim(), 'password': password,
      }));

  Future<Map<String, dynamic>> profile() async => await client.get('/auth/me') as Map<String, dynamic>;

  Future<void> logout(String refreshToken) async {
    await client.post('/auth/logout', {'refreshToken': refreshToken});
  }

  Future<String> requestRecovery({required String tenantId, required String email}) async {
    final response = await client.postPublic('/auth/forgot-password', {
      if (tenantId.isNotEmpty) 'tenantId': tenantId, 'email': email.trim(),
    }) as Map<String, dynamic>;
    return response['message'] as String? ?? 'Si la cuenta existe, recibirás un enlace de recuperación.';
  }

  Future<Map<String, dynamic>> resetPassword({required String token, required String newPassword, String? tenantId}) async =>
      _session(await client.postPublic('/auth/reset-password', {
        'token': token, 'newPassword': newPassword,
        if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
      }));

  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    await client.put('/auth/me/password', {'currentPassword': currentPassword, 'newPassword': newPassword});
  }

  static Map<String, dynamic> _session(Object? response) {
    if (response is! Map<String, dynamic> || response['token'] is! String || response['refreshToken'] is! String) {
      throw const ApiException('Respuesta de sesión incompleta.');
    }
    return response;
  }
}
