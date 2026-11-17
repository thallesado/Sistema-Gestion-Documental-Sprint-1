import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../auth/biometric_service.dart';
import '../auth/user_permissions.dart';
import '../errors/api_exception.dart';
import '../models/user_profile_model.dart';
import '../notifications/workflow_notifications.dart';
import 'api_client.dart';
import 'audit_api.dart';
import 'auth_repository.dart';
import 'clinical_api.dart';
import 'documents_api.dart';
import 'expedients_api.dart';
import 'ocr_api.dart';
import 'workflows_api.dart';

/// Organización seleccionable en el login (GET /tenants/public).
class PublicTenant {
  const PublicTenant(this.id, this.name);
  final String id;
  final String name;
}

/// Punto de entrada de la app: sesión y acceso a los servicios de cada módulo.
class AuthApi {
  AuthApi({http.Client? client, FlutterSecureStorage? storage, BiometricService? biometrics})
    : client = ApiClient(client: client, storage: storage),
      biometrics = biometrics ?? BiometricService(storage: storage);

  final ApiClient client;
  final BiometricService biometrics;
  late final AuthRepository auth = AuthRepository(client);
  bool mustChangePassword = false;
  bool platformAdmin = false;

  late final documents = DocumentsApi(client);
  late final workflows = WorkflowsApi(client);
  late final clinical = ClinicalApi(client);
  late final ocr = OcrApi(client);
  late final expedients = ExpedientsApi(client, documents);
  late final audit = AuditApi(client);

  /// Permisos por función del usuario actual; el shell y las pantallas se redibujan al cambiar.
  final ValueNotifier<UserPermissions> permissions = ValueNotifier(UserPermissions.unknown);

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
      body = await auth.login(tenantId: tenantId, username: username, password: password);
    } on ApiException catch (error) {
      if (error.statusCode == 401) throw const ApiException('Credenciales u organización inválidas.', statusCode: 401);
      rethrow;
    }
    await establishSession(body);
  }

  Future<void> establishSession(Map<String, dynamic> body) async {
    await client.saveTokens(body['token'] as String, body['refreshToken'] as String);
    permissions.value = UserPermissions.fromJson(body);
    mustChangePassword = body['mustChangePassword'] == true;
  }

  Future<UserProfileModel> restoreProfile() async {
    final profile = UserProfileModel.fromJson(await auth.profile());
    permissions.value = profile.permissions;
    mustChangePassword = profile.rawJson['mustChangePassword'] == true;
    platformAdmin = profile.rawJson['platformAdmin'] == true;
    return profile;
  }

  Future<String> requestRecovery({required String tenantId, required String email}) =>
      auth.requestRecovery(tenantId: tenantId, email: email);

  Future<void> resetPassword({required String token, required String newPassword, String? tenantId}) async =>
      establishSession(await auth.resetPassword(token: token, newPassword: newPassword, tenantId: tenantId));

  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    await auth.changePassword(currentPassword: currentPassword, newPassword: newPassword);
    if (mustChangePassword) {
      await client.clearSession();
      mustChangePassword = false;
    }
  }

  /// Recarga los permisos desde `/auth/me` (sesión restaurada al abrir la app).
  /// Si falla se mantienen los actuales: ocultar menús nunca sustituye la autorización del servidor.
  Future<UserPermissions> loadPermissions() async {
    try {
      await restoreProfile();
    } on ApiException {
      // Sin conexión o servidor antiguo: se conservan los permisos conocidos.
    }
    return permissions.value;
  }

  /// Cierra la sesión también en el servidor (revoca el refresh token), como la web.
  Future<void> logout() async {
    final refreshToken = await client.storage.read(key: ApiClient.refreshTokenKey);
    if (refreshToken != null) {
      try {
        await auth.logout(refreshToken);
      } on ApiException {
        // La sesión local se elimina igualmente.
      }
    }
    await client.clearSession();
    permissions.value = UserPermissions.unknown;
    mustChangePassword = false;
    platformAdmin = false;
    await WorkflowNotifications.instance.stop();
  }

  Future<Map<String, dynamic>> me() => auth.profile();

  /// Perfil fuertemente tipado del usuario autenticado (Clean Architecture / SRP).
  Future<UserProfileModel> getProfile() async {
    final raw = await me();
    return UserProfileModel.fromJson(raw);
  }

  Future<Map<String, dynamic>> dashboard() async =>
      await client.get('/dashboard', query: {'limit': 10}) as Map<String, dynamic>;
}
