/// Permisos por función del usuario, tal como los devuelven `POST /auth/login` y `GET /auth/me`
/// (mismos códigos que las authorities del JWT y que el menú de la web).
///
/// Solo deciden qué se muestra: la autorización real la siguen aplicando el backend y RLS.
class UserPermissions {
  const UserPermissions(this.codes, {this.known = true});

  /// Servidor sin el campo `permissions` o aún sin cargar: no se oculta nada y decide el backend.
  static const unknown = UserPermissions(<String>{}, known: false);

  final Set<String> codes;

  /// `false` si el servidor no informó permisos; en ese caso [can] devuelve siempre `true`.
  final bool known;

  /// Lee `permissions` de la respuesta de login o de `/auth/me`.
  factory UserPermissions.fromJson(Map<String, dynamic>? json) {
    final raw = json?['permissions'];
    if (raw is! List) return unknown;
    return UserPermissions(raw.whereType<String>().toSet());
  }

  bool can(String code) => !known || codes.contains(code);

  /// Basta con tener uno de los códigos, como `hasAnyAuthority` en el backend.
  bool canAny(Iterable<String> required) => !known || required.any(codes.contains);
}

/// Códigos usados por la app, copiados de los `@PreAuthorize` y de `WorkflowEngineService`.
abstract final class Permissions {
  static const documentRead = 'document:read';
  static const documentCreate = 'document:create';
  static const documentUpdate = 'document:update';
  static const ocrCreate = 'ocr:create';
  static const ocrRead = 'ocr:read';
  static const ocrUpdate = 'ocr:update';
  static const patientCreate = 'patient:create';
  static const patientRead = 'patient:read';
  static const taskRead = 'task:read';
  static const taskUpdate = 'task:update';
  static const notificationRead = 'notification:read';
  static const workflowApprove = 'workflow:approve';
  static const workflowReview = 'workflow:review';
  static const workflowReject = 'workflow:reject';
  static const workflowReturn = 'workflow:return';
}
