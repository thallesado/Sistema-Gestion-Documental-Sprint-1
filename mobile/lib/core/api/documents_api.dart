import 'dart:io';

import 'package:path_provider/path_provider.dart';

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

  Future<Map<String, dynamic>> detail(String id) async =>
      await _client.get('/documents/$id') as Map<String, dynamic>;

  Future<List<Map<String, dynamic>>> versions(String documentId) async =>
      (await _client.get('/documents/$documentId/versions') as List<dynamic>).cast<Map<String, dynamic>>();

  /// Descarga una versión al almacenamiento de la app y devuelve el archivo.
  Future<File> downloadVersion(String documentId, Map<String, dynamic> version) async {
    final bytes = await _client.getBytes('/documents/$documentId/versions/${version['id']}/content');
    final dir = await getApplicationDocumentsDirectory();
    final name = (version['fileName'] as String?)?.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_') ?? 'documento';
    final file = File('${dir.path}${Platform.pathSeparator}$name');
    return file.writeAsBytes(bytes, flush: true);
  }
}
