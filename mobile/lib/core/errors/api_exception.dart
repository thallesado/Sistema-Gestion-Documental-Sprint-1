/// Error devuelto por la API o por la red, con un mensaje apto para mostrar al usuario.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isNotFound => statusCode == 404;
  bool get isForbidden => statusCode == 403;

  @override
  String toString() => message;
}

/// La sesión no pudo renovarse: el usuario debe volver a iniciar sesión.
class SessionExpiredException extends ApiException {
  const SessionExpiredException()
    : super('Tu sesión expiró. Vuelve a iniciar sesión.', statusCode: 401);
}
