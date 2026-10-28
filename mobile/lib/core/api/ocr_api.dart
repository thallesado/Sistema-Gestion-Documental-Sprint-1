import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../errors/api_exception.dart';
import '../utils/upload_rules.dart';
import 'api_client.dart';

/// Cliente API para el motor OCR y digitalización móvil.
class OcrApi {
  OcrApi(this._client);

  final ApiClient _client;

  /// Procesa una imagen o documento con el motor OCR multimodal (Gemini).
  /// Sube como multipart/form-data al endpoint `/ocr/process`.
  Future<Map<String, dynamic>> processFile({
    required String filePath,
    required String fileName,
  }) async {
    final file = File(filePath);
    if (!file.existsSync()) {
      throw const ApiException('El archivo no existe en el dispositivo.');
    }
    final bytes = await file.readAsBytes();
    if (bytes.length > UploadRules.maxBytes) {
      throw const ApiException('La imagen supera el límite de 25 MB.');
    }

    final mime = UploadRules.mimeFor(fileName) ?? 'image/jpeg';

    final result = await _client.postMultipart(
      '/ocr/process',
      files: () => [
        http.MultipartFile.fromBytes(
          'file',
          bytes,
          filename: fileName,
          contentType: MediaType.parse(mime),
        ),
      ],
    ) as Map<String, dynamic>;

    return result;
  }

  /// Digitalizaciones recientes (últimas 10 del usuario/tenant).
  Future<List<Map<String, dynamic>>> recentJobs() async {
    final list = await _client.get('/ocr/jobs') as List<dynamic>;
    return list.cast<Map<String, dynamic>>();
  }

  /// Consulta el estado actual de una digitalización específica.
  Future<Map<String, dynamic>> getJob(String id) async {
    return await _client.get('/ocr/jobs/$id') as Map<String, dynamic>;
  }

  /// Valida la extracción de metadatos (REQUIRES_VALIDATION -> VALIDATED).
  Future<Map<String, dynamic>> validate(String id, {Map<String, dynamic>? corrections}) async {
    return await _client.post('/ocr/jobs/$id/validate', corrections ?? {}) as Map<String, dynamic>;
  }

  /// Rechaza la extracción (REQUIRES_VALIDATION o VALIDATED -> REJECTED).
  Future<Map<String, dynamic>> reject(String id, {String? reason}) async {
    return await _client.post('/ocr/jobs/$id/reject', {
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    }) as Map<String, dynamic>;
  }

  /// Indexa el documento validado en el repositorio (VALIDATED -> INDEXED).
  Future<Map<String, dynamic>> index(String id, {
    required String documentTypeId,
    String? code,
    String? name,
    String? description,
    String? departmentId,
    String? expedientId,
    String? patientId,
  }) async {
    final payload = <String, dynamic>{
      'documentTypeId': documentTypeId,
    };
    if (code != null && code.trim().isNotEmpty) payload['code'] = code.trim();
    if (name != null && name.trim().isNotEmpty) payload['name'] = name.trim();
    if (description != null && description.trim().isNotEmpty) payload['description'] = description.trim();
    if (departmentId != null) payload['departmentId'] = departmentId;
    if (expedientId != null) payload['expedientId'] = expedientId;
    if (patientId != null) payload['patientId'] = patientId;

    return await _client.post('/ocr/jobs/$id/index', payload) as Map<String, dynamic>;
  }

  /// Obtiene los tipos documentales disponibles para indexar.
  Future<List<Map<String, dynamic>>> documentTypes() async {
    try {
      final response = await _client.get('/document-types', query: {'active': true, 'size': 50}) as Map<String, dynamic>;
      return (response['content'] as List<dynamic>).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }
}
