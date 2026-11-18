import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path_provider/path_provider.dart';

import '../errors/api_exception.dart';
import '../i18n/app_language.dart';
import '../models/document_model.dart';
import '../utils/upload_rules.dart';
import 'api_client.dart';

/// Documentos y versiones: mismos endpoints que DocumentApiService de la web.
/// Soporta modelos fuertemente tipados [DocumentModel] y compatibilidad con Map.
class DocumentsApi {
  DocumentsApi(this._client);

  final ApiClient _client;
  final Map<String, String> _stateTokens = {};

  Future<List<Map<String, dynamic>>> list({String? search, String? status, int size = 25}) async {
    final body = await _client.get('/documents', query: {
      'page': 0,
      'size': size,
      'filter': search,
      'status': status,
    }) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  /// Lista los documentos del usuario autenticado (mis trámites / mis documentos).
  Future<List<Map<String, dynamic>>> listMine({String? search, String? status, int size = 25}) async {
    final body = await _client.get('/documents/mine', query: {
      'page': 0,
      'size': size,
      'filter': search,
      'status': status,
    }) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  /// Catálogo de tipos documentales disponibles para clasificar y crear documentos.
  Future<List<Map<String, dynamic>>> documentTypes({int size = 50}) async {
    try {
      final body = await _client.get('/document-types', query: {'page': 0, 'size': size}) as Map<String, dynamic>;
      return (body['content'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  /// Documentos de un expediente. El backend no filtra por expediente, así que se revisan
  /// los más recientes del tenant y se quedan los que apuntan a [expedientId].
  Future<List<Map<String, dynamic>>> byExpedient(String expedientId, {int scan = 200}) async =>
      (await list(size: scan)).where((doc) => doc['expedientId'] == expedientId).toList();

  /// Alta de documento completa (`POST /documents`, requiere `document:create`). [data] sigue
  /// `DocumentCreateRequest`; los valores vacíos no se envían.
  Future<Map<String, dynamic>> create(Map<String, dynamic> data) async => await _client.post('/documents', {
    for (final entry in data.entries)
      if (entry.value != null && !(entry.value is String && (entry.value as String).trim().isEmpty))
        entry.key: entry.value is String ? (entry.value as String).trim() : entry.value,
  }) as Map<String, dynamic>;

  /// Creación rápida de un documento nuevo en el repositorio (`POST /documents`).
  Future<Map<String, dynamic>> createDocument({
    required String name,
    required String documentTypeId,
    String? description,
    String? code,
  }) async {
    final payload = <String, dynamic>{
      'name': name.trim(),
      'documentTypeId': documentTypeId,
      if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
      if (code != null && code.trim().isNotEmpty) 'code': code.trim(),
    };
    return await _client.post('/documents', payload) as Map<String, dynamic>;
  }

  /// Tipos documentales activos.
  Future<List<Map<String, dynamic>>> types() async {
    final body = await _client.get('/document-types', query: {'size': 100, 'active': true}) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> departments() async {
    final body = await _client.get('/departments', query: {'size': 100});
    if (body is List) return body.cast<Map<String, dynamic>>();
    return ((body as Map<String, dynamic>)['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<List<String>> specialties() async => (await _client.get('/documents/specialties') as List<dynamic>).cast<String>();

  Future<List<String>> processes() async => (await _client.get('/documents/processes') as List<dynamic>).cast<String>();

  Future<Map<String, dynamic>> detail(String id) async {
    final response = await _client.getResponse('/documents/$id');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final token = response.headers['etag'];
    if (token != null) _stateTokens[id] = token;
    body['stateToken'] = token;
    return body;
  }

  Future<List<Map<String, dynamic>>> versions(String documentId) async =>
      (await _client.get('/documents/$documentId/versions') as List<dynamic>).cast<Map<String, dynamic>>();

  /// Sube una nueva versión (mismo contrato que la web: partes `file` y `changeReason`).
  /// Requiere `document:update`; el servidor guarda el SHA-256 y devuelve la versión creada.
  Future<Map<String, dynamic>> uploadVersion(String documentId, {required String filePath, required String fileName, required String reason}) async {
    final mime = UploadRules.mimeFor(fileName);
    if (mime == null) throw ApiException(tr('Formato no permitido. Usa PDF, JPG, PNG o DOCX.'));
    var token = _stateTokens[documentId];
    if (token == null) {
      await detail(documentId);
      token = _stateTokens[documentId];
    }
    if (token == null) throw ApiException(tr('Recarga el documento antes de subir una versión.'));
    final response = await _client.postMultipartResponse(
      '/documents/$documentId/versions',
      fields: {'changeReason': reason.trim()},
      headers: {'If-Match': token},
      files: () => [
        http.MultipartFile.fromBytes('file', File(filePath).readAsBytesSync(), filename: fileName, contentType: MediaType.parse(mime)),
      ],
    );
    final nextToken = response.headers['etag'];
    if (nextToken != null) _stateTokens[documentId] = nextToken;
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Descarga una versión al almacenamiento de la app y devuelve el archivo.
  Future<File> downloadVersion(String documentId, Map<String, dynamic> version) async {
    final bytes = await _client.getBytes('/documents/$documentId/versions/${version['id']}/content');
    final dir = await getApplicationDocumentsDirectory();
    final name = (version['fileName'] as String?)?.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_') ?? 'documento';
    final file = File('${dir.path}${Platform.pathSeparator}$name');
    return file.writeAsBytes(bytes, flush: true);
  }

  // --- MÉTODOS FUERTEMENTE TIPADOS (Clean Architecture / SRP) ---

  /// Obtiene los documentos tipados como [DocumentModel].
  Future<List<DocumentModel>> getDocuments({String? search, String? status, int size = 25}) async {
    final rawList = await list(search: search, status: status, size: size);
    return rawList.map(DocumentModel.fromJson).toList();
  }

  /// Obtiene los documentos propios del usuario autenticado.
  Future<List<DocumentModel>> getMyDocuments({String? search, String? status, int size = 25}) async {
    final rawList = await listMine(search: search, status: status, size: size);
    return rawList.map(DocumentModel.fromJson).toList();
  }

  /// Obtiene el detalle fuertemente tipado de un documento.
  Future<DocumentModel> getDocumentDetail(String id) async {
    final raw = await detail(id);
    return DocumentModel.fromJson(raw);
  }

  /// Obtiene la lista de versiones como [DocumentVersionModel].
  Future<List<DocumentVersionModel>> getVersions(String documentId) async {
    final rawList = await versions(documentId);
    return rawList.map(DocumentVersionModel.fromJson).toList();
  }
}
