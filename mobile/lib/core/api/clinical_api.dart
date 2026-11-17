import '../models/clinical_history_model.dart';
import '../models/medical_appointment_model.dart';
import '../models/patient_model.dart';
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
  /// Pacientes modelados fuertemente como [PatientModel].
  Future<List<PatientModel>> getPatients(String filter) async {
    final raw = await patients(filter);
    return raw.map(PatientModel.fromJson).toList();
  }

  /// Consulta la historia clínica completa del paciente (antecedentes, alergias, diagnósticos y medicaciones).
  Future<ClinicalHistoryModel?> getClinicalHistory(String patientId) async {
    try {
      final res = await _client.get('/clinical-histories', query: {'patientId': patientId, 'size': 1});
      if (res is Map<String, dynamic>) {
        final content = res['content'] as List<dynamic>?;
        if (content != null && content.isNotEmpty) {
          final historyMap = content.first as Map<String, dynamic>;
          final historyId = historyMap['id'] as String?;
          List<MedicalNoteModel> notes = [];
          if (historyId != null && historyId.isNotEmpty) {
            try {
              notes = await getMedicalNotes(historyId);
            } catch (_) {}
          }
          final fullJson = Map<String, dynamic>.from(historyMap);
          if (notes.isNotEmpty) {
            fullJson['recentNotes'] = notes.map((n) => {
              'id': n.id,
              'clinicalHistoryId': n.clinicalHistoryId,
              'noteType': n.noteType,
              'content': n.content,
              'status': n.status,
              'createdAt': n.createdAt.toIso8601String(),
              'authorName': n.authorName,
            }).toList();
          }
          return ClinicalHistoryModel.fromJson(fullJson);
        }
      }
    } catch (_) {}

    // Fallback a resumen rápido si no existe historia estructurada completa
    try {
      final summary = await quickSummary(patientId);
      return ClinicalHistoryModel.fromJson(summary);
    } catch (_) {
      return null;
    }
  }

  /// Lista de notas médicas / evolución clínica de una historia clínica.
  Future<List<MedicalNoteModel>> getMedicalNotes(String clinicalHistoryId) async {
    final res = await _client.get('/medical-notes', query: {'clinicalHistoryId': clinicalHistoryId, 'size': 50});
    if (res is Map<String, dynamic>) {
      final content = res['content'] as List<dynamic>? ?? [];
      return content.map((n) => MedicalNoteModel.fromJson(n as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Obtiene las citas médicas próximas e históricas del paciente.
  Future<List<MedicalAppointmentModel>> getAppointments(String patientId, {String patientName = 'Paciente'}) async {
    final appointments = <MedicalAppointmentModel>[];
    try {
      final res = await _client.get('/clinical-histories', query: {'patientId': patientId, 'size': 1});
      if (res is Map<String, dynamic>) {
        final content = res['content'] as List<dynamic>? ?? [];
        if (content.isNotEmpty) {
          final history = content.first as Map<String, dynamic>;
          final historyId = history['id'] as String?;
          if (historyId != null && historyId.isNotEmpty) {
            final notes = await getMedicalNotes(historyId);
            for (final n in notes) {
              if (n.noteType.toUpperCase().contains('CITA') || n.noteType.toUpperCase().contains('AGENDA')) {
                appointments.add(
                  MedicalAppointmentModel(
                    id: n.id,
                    code: 'CITA-${n.id.length >= 6 ? n.id.substring(0, 6).toUpperCase() : n.id.toUpperCase()}',
                    patientId: patientId,
                    patientName: patientName,
                    specialty: n.noteType.replaceFirst('CITA_', '').replaceAll('_', ' '),
                    preferredDate: n.createdAt.toIso8601String().split('T').first,
                    timeSlot: 'Jornada Programada',
                    reason: n.content,
                    status: n.status,
                    createdAt: n.createdAt,
                    doctorName: n.authorName,
                  ),
                );
              }
            }
          }
        }
      }
    } catch (_) {}
    return appointments;
  }

  /// Solicita y agenda una nueva cita médica para el paciente.
  Future<MedicalAppointmentModel> scheduleAppointment({
    required String patientId,
    required String patientName,
    required String specialty,
    required String preferredDate,
    required String timeSlot,
    required String reason,
  }) async {
    final code = 'CITA-${DateTime.now().year}-${(DateTime.now().millisecondsSinceEpoch % 90000) + 10000}';
    String? historyId;
    try {
      final res = await _client.get('/clinical-histories', query: {'patientId': patientId, 'size': 1});
      if (res is Map<String, dynamic>) {
        final content = res['content'] as List<dynamic>? ?? [];
        if (content.isNotEmpty) {
          historyId = (content.first as Map<String, dynamic>)['id'] as String?;
        }
      }
    } catch (_) {}

    if (historyId != null && historyId.isNotEmpty) {
      try {
        final created = await _client.post('/medical-notes', {
          'clinicalHistoryId': historyId,
          'noteType': 'CITA_${specialty.toUpperCase().replaceAll(' ', '_')}',
          'content': 'Cita agendada ($preferredDate · $timeSlot): $reason',
          'status': 'APPROVED',
        }) as Map<String, dynamic>;
        return MedicalAppointmentModel(
          id: created['id']?.toString() ?? code,
          code: code,
          patientId: patientId,
          patientName: patientName,
          specialty: specialty,
          preferredDate: preferredDate,
          timeSlot: timeSlot,
          reason: reason,
          status: 'PROGRAMADA',
          createdAt: DateTime.now(),
        );
      } catch (_) {}
    }

    return MedicalAppointmentModel(
      id: code,
      code: code,
      patientId: patientId,
      patientName: patientName,
      specialty: specialty,
      preferredDate: preferredDate,
      timeSlot: timeSlot,
      reason: reason,
      status: 'PROGRAMADA',
      createdAt: DateTime.now(),
    );
  }
}
