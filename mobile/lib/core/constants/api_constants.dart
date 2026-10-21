/// URL base de la API. Prioridad: valor guardado por el usuario en la app,
/// luego `--dart-define=NEXODOCS_API_URL=...`, luego el valor por defecto.
const _envUrl = String.fromEnvironment('NEXODOCS_API_URL', defaultValue: '');

const defaultApiBaseUrl = 'http://127.0.0.1:8080/api/v1';

String _customApiBaseUrl = _envUrl.isNotEmpty ? _envUrl : defaultApiBaseUrl;

String get apiBaseUrl => _customApiBaseUrl;

set apiBaseUrl(String url) {
  _customApiBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
}
