const _envUrl = String.fromEnvironment('NEXODOCS_API_URL', defaultValue: '');

String _customApiBaseUrl = _envUrl.isNotEmpty ? _envUrl : 'http://127.0.0.1:8080/api/v1';

String get apiBaseUrl => _customApiBaseUrl;

set apiBaseUrl(String url) {
  _customApiBaseUrl = url;
}
