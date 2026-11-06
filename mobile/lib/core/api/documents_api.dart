import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path_provider/path_provider.dart';

import '../errors/api_exception.dart';
import '../utils/upload_rules.dart';
import 'api_client.dart';

/// Documentos y versiones: mismos endpoints que DocumentApiService de la web.
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
    if (mime == null) throw const ApiException('Formato no permitido. Usa PDF, JPG, PNG o DOCX.');
    var token = _stateTokens[documentId];
    if (token == null) {
      await detail(documentId);
      token = _stateTokens[documentId];
    }
    if (token == null) throw const ApiException('Recarga el documento antes de subir una versión.');
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
}
