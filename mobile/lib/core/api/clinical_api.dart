import 'api_client.dart';

/// Pacientes, historia clínica y notas médicas: mismos endpoints que ClinicalApiService de la web.
class ClinicalApi {
  ClinicalApi(this._client);

  final ApiClient _client;

  // ── Pacientes ──────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> patients(String filter, {int size = 20}) async {
    final body = await _client.get('/patients', query: {'size': size, 'filter': filter}) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> patient(String id) async => await _client.get('/patients/$id') as Map<String, dynamic>;

  /// Requiere `patient:create`. [data] usa los campos de `PatientCreateRequest`.
  Future<Map<String, dynamic>> createPatient(Map<String, dynamic> data) async =>
      await _client.post('/patients', _withoutEmpty(data)) as Map<String, dynamic>;

  Future<Map<String, dynamic>> quickSummary(String patientId) async =>
      await _client.get('/patients/$patientId/quick-summary') as Map<String, dynamic>;

  // ── Historia clínica ──────────────────────────────────────────────────────

  /// Historia del paciente o `null` si aún no tiene una.
  Future<Map<String, dynamic>?> historyForPatient(String patientId) async {
    final body = await _client.get('/clinical-histories', query: {'patientId': patientId, 'size': 1}) as Map<String, dynamic>;
    final content = (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
    return content.isEmpty ? null : content.first;
  }

  Future<Map<String, dynamic>> history(String id) async =>
      await _client.get('/clinical-histories/$id') as Map<String, dynamic>;

  /// Requiere `patient:create`. [data] sigue `ClinicalHistoryRequest`.
  Future<Map<String, dynamic>> createHistory(String patientId, Map<String, dynamic> data) async =>
      await _client.post('/clinical-histories', {...data, 'patientId': patientId}) as Map<String, dynamic>;

  /// Requiere `patient:update`; el servidor guarda una revisión con los campos modificados.
  Future<Map<String, dynamic>> updateHistory(String id, String patientId, Map<String, dynamic> data) async =>
      await _client.put('/clinical-histories/$id', {...data, 'patientId': patientId}) as Map<String, dynamic>;

  Future<List<Map<String, dynamic>>> timeline(String historyId) async =>
      (await _client.get('/clinical-histories/$historyId/timeline') as List<dynamic>).cast<Map<String, dynamic>>();

  Future<List<Map<String, dynamic>>> linkedDocuments(String historyId) async =>
      (await _client.get('/clinical-histories/$historyId/documents') as List<dynamic>).cast<Map<String, dynamic>>();

  Future<void> linkDocument(String historyId, String documentId) =>
      _client.post('/clinical-histories/$historyId/documents/$documentId');

  // ── Notas médicas ─────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> notes(String historyId, {String? status}) async {
    final body = await _client.get('/medical-notes', query: {
      'clinicalHistoryId': historyId,
      'status': status,
      'size': 50,
    }) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  /// [noteType]: EVOLUTION, PRESCRIPTION o CONSULTATION; [status]: DRAFT o APPROVED (igual que la web).
  Future<Map<String, dynamic>> createNote({
    required String historyId,
    required String noteType,
    required String content,
    String status = 'DRAFT',
  }) async =>
      await _client.post('/medical-notes', {
        'clinicalHistoryId': historyId,
        'noteType': noteType,
        'content': content,
        'status': status,
      }) as Map<String, dynamic>;

  /// DRAFT → APPROVED o VOIDED (requiere `medical_note:update`).
  Future<Map<String, dynamic>> changeNoteStatus(String noteId, String status) async =>
      await _client.patch('/medical-notes/$noteId/status', {'status': status}) as Map<String, dynamic>;

  static Map<String, dynamic> _withoutEmpty(Map<String, dynamic> data) => {
    for (final entry in data.entries)
      if (entry.value != null && !(entry.value is String && (entry.value as String).trim().isEmpty))
        entry.key: entry.value is String ? (entry.value as String).trim() : entry.value,
  };
}
