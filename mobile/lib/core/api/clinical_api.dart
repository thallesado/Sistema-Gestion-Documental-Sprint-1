import 'api_client.dart';

/// Pacientes y resumen clínico rápido.
class ClinicalApi {
  ClinicalApi(this._client);

  final ApiClient _client;

  Future<List<Map<String, dynamic>>> patients(String filter) async {
    final body = await _client.get('/patients', query: {'size': 20, 'filter': filter}) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> quickSummary(String patientId) async =>
      await _client.get('/patients/$patientId/quick-summary') as Map<String, dynamic>;
}
