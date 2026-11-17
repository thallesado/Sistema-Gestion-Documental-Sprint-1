import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path_provider/path_provider.dart';

import '../errors/api_exception.dart';
import '../i18n/app_language.dart';
import '../utils/upload_rules.dart';
import 'api_client.dart';

/// Documentos y versiones: mismos endpoints que DocumentApiService de la web.
class DocumentsApi {
  DocumentsApi(this._client);

  final ApiClient _client;

  Future<List<Map<String, dynamic>>> list({String? search, String? status, int size = 25}) async {
    final body = await _client.get('/documents', query: {
      'page': 0,
      'size': size,
      'filter': search,
      'status': status,
    }) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  /// Documentos de un expediente. El backend no filtra por expediente, así que se revisan
  /// los más recientes del tenant y se quedan los que apuntan a [expedientId].
  Future<List<Map<String, dynamic>>> byExpedient(String expedientId, {int scan = 200}) async =>
      (await list(size: scan)).where((doc) => doc['expedientId'] == expedientId).toList();

  /// Alta de documento (`POST /documents`, requiere `document:create`). [data] sigue
  /// `DocumentCreateRequest`; los valores vacíos no se envían.
  Future<Map<String, dynamic>> create(Map<String, dynamic> data) async => await _client.post('/documents', {
    for (final entry in data.entries)
      if (entry.value != null && !(entry.value is String && (entry.value as String).trim().isEmpty))
        entry.key: entry.value is String ? (entry.value as String).trim() : entry.value,
  }) as Map<String, dynamic>;

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

  Future<Map<String, dynamic>> detail(String id) async =>
      await _client.get('/documents/$id') as Map<String, dynamic>;

  Future<List<Map<String, dynamic>>> versions(String documentId) async =>
      (await _client.get('/documents/$documentId/versions') as List<dynamic>).cast<Map<String, dynamic>>();

  /// Sube una nueva versión (mismo contrato que la web: partes `file` y `changeReason`).
  /// Requiere `document:update`; el servidor guarda el SHA-256 y devuelve la versión creada.
  Future<Map<String, dynamic>> uploadVersion(String documentId, {required String filePath, required String fileName, required String reason}) async {
    final mime = UploadRules.mimeFor(fileName);
    if (mime == null) throw ApiException(tr('Formato no permitido. Usa PDF, JPG, PNG o DOCX.'));
    return await _client.postMultipart(
      '/documents/$documentId/versions',
      fields: {'changeReason': reason.trim()},
      files: () => [
        http.MultipartFile.fromBytes('file', File(filePath).readAsBytesSync(), filename: fileName, contentType: MediaType.parse(mime)),
      ],
    ) as Map<String, dynamic>;
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
