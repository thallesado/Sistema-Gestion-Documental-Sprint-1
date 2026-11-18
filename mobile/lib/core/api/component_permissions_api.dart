import '../errors/api_exception.dart';
import 'api_client.dart';

/// Estado de un campo de formulario según los privilegios por componente (B2) del usuario.
enum FieldState {
  hidden,
  readOnly,
  editable;

  static FieldState parse(Object? value) => switch (value) {
    'HIDDEN' => FieldState.hidden,
    'VISIBLE_READONLY' => FieldState.readOnly,
    _ => FieldState.editable,
  };

  bool get visible => this != FieldState.hidden;
  bool get canEdit => this == FieldState.editable;
}

/// Estados efectivos de un formulario (`documento.nuevo`, `nota_medica`, …), como
/// ComponentPermissionService de la web. Solo deciden cómo se pinta: el servidor vuelve a validar.
class FormAccess {
  const FormAccess(this._states);

  /// Sin respuesta del servidor todo queda editable, igual que en la web.
  static const open = FormAccess({});

  final Map<String, FieldState> _states;

  FieldState operator [](String component) => _states[component] ?? FieldState.editable;

  bool visible(String component) => this[component].visible;
  bool editable(String component) => this[component].canEdit;
}

class ComponentPermissionsApi {
  ComponentPermissionsApi(this._client);

  final ApiClient _client;
  final _cache = <String, FormAccess>{};

  Future<FormAccess> form(String form) async {
    final cached = _cache[form];
    if (cached != null) return cached;
    try {
      final body = await _client.get('/component-permissions/me', query: {'form': form});
      final states = body is Map<String, dynamic>
          ? {for (final entry in body.entries) entry.key: FieldState.parse(entry.value)}
          : <String, FieldState>{};
      return _cache[form] = FormAccess(states);
    } on SessionExpiredException {
      rethrow;
    } on ApiException {
      return FormAccess.open;
    }
  }

  /// Los estados dependen del usuario: se descartan al cerrar sesión.
  void clear() => _cache.clear();
}
