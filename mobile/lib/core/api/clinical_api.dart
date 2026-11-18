import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../errors/api_exception.dart';
import '../i18n/app_language.dart';
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
  /// Dictado de nota por voz: envía el audio a `POST /medical-notes/ai-draft` y devuelve el borrador
  /// `{transcript, noteType, subjective, objective, assessment, plan, warnings[]}`. No guarda nada.
  /// El archivo lo borra quien llama tras el envío exitoso o al cancelar.
  Future<Map<String, dynamic>> aiDraft({
    required String historyId,
    required String audioPath,
    String? language,
  }) async {
    final bytes = await _readAudioBytes(audioPath);
    if (bytes.length > maxAudioBytes) {
      throw ApiException(tr('El audio supera el límite de 25 MB.'));
    }
    final result = await _client.postMultipart(
      '/medical-notes/ai-draft',
      fields: {
        'clinicalHistoryId': historyId,
        'language': ?language,
      },
      files: () => [
        http.MultipartFile.fromBytes(
          'audio',
          bytes,
          filename: 'dictado.wav',
          contentType: MediaType('audio', 'wav'),
        ),
      ],
    );
    return result as Map<String, dynamic>;
  }

  static const maxAudioBytes = 25 * 1024 * 1024;

  /// En web la grabación es una URL blob del navegador (sin dart:io); en móvil es un archivo temporal.
  Future<Uint8List> _readAudioBytes(String audioPath) async {
    if (kIsWeb) {
      final response = await http.get(Uri.parse(audioPath));
      if (response.statusCode != 200 || response.bodyBytes.isEmpty) {
        throw ApiException(tr('No se encontró el audio grabado.'));
      }
      return response.bodyBytes;
    }
    final file = File(audioPath);
    if (!file.existsSync()) {
      throw ApiException(tr('No se encontró el audio grabado.'));
    }
    // Lectura síncrona: un dictado de 5 minutos en WAV 16 kHz mono pesa ~9,6 MB; así el envío es determinista en pruebas.
    return file.readAsBytesSync();
  }

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
    // Antes los errores se ignoraban y se devolvía una cita "programada" que nunca llegó al servidor.
    final res = await _client.get('/clinical-histories', query: {'patientId': patientId, 'size': 1});
    final content = res is Map<String, dynamic> ? res['content'] as List<dynamic>? ?? const [] : const [];
    final historyId = content.isEmpty ? null : (content.first as Map<String, dynamic>)['id'] as String?;
    if (historyId == null || historyId.isEmpty) {
      throw ApiException(tr('El paciente no tiene historia clínica; créala antes de agendar una cita.'));
    }
    // El backend solo crea notas en BORRADOR (MedicalNoteService.create).
    final created = await _client.post('/medical-notes', {
      'clinicalHistoryId': historyId,
      'noteType': 'CITA_${specialty.toUpperCase().replaceAll(' ', '_')}',
      'content': 'Cita agendada ($preferredDate · $timeSlot): $reason',
      'status': 'DRAFT',
    }) as Map<String, dynamic>;
    final rawStatus = created['status']?.toString();
    return MedicalAppointmentModel(
      id: created['id']?.toString() ?? code,
      code: code,
      patientId: patientId,
      patientName: patientName,
      specialty: specialty,
      preferredDate: preferredDate,
      timeSlot: timeSlot,
      reason: reason,
      status: (rawStatus == null || rawStatus.isEmpty) ? 'DRAFT' : rawStatus,
      createdAt: DateTime.now(),
    );
  }
}
