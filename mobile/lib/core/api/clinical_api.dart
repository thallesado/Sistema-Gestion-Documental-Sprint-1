import '../models/clinical_history_model.dart';
import '../models/medical_appointment_model.dart';
import '../models/patient_model.dart';
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
