import '../models/expedient_model.dart';
import '../models/public_radicacion_model.dart';
import '../models/radicacion_model.dart';
import 'api_client.dart';
import 'documents_api.dart';

/// API de consulta y gestión de Expedientes Digitales (`/api/v1/expedients`).
/// Permite agrupar documentos y trámites bajo una misma radicación.
class ExpedientsApi {
  ExpedientsApi(this._client, [this._documents]);

  final ApiClient _client;
  final DocumentsApi? _documents;

  /// Consulta paginada de expedientes con filtro por texto y estado.
  Future<Map<String, dynamic>> list({
    String? filter,
    String? status,
    int page = 0,
    int size = 20,
  }) async {
    final query = <String, dynamic>{
      'page': page,
      'size': size,
      if (filter != null && filter.trim().isNotEmpty) 'filter': filter.trim(),
      if (status != null && status.trim().isNotEmpty && status.toUpperCase() != 'ALL')
        'status': status.trim().toUpperCase(),
    };
    return await _client.get('/expedients', query: query) as Map<String, dynamic>;
  }

  /// Detalle de un expediente por su ID.
  Future<Map<String, dynamic>> detail(String id) async =>
      await _client.get('/expedients/$id') as Map<String, dynamic>;

  /// Cierra un expediente activo (`PATCH /expedients/{id}/close`).
  Future<Map<String, dynamic>> close(String id) async =>
      await _client.patch('/expedients/$id/close') as Map<String, dynamic>;

  /// Archiva un expediente (`PATCH /expedients/{id}/archive`).
  Future<Map<String, dynamic>> archive(String id) async =>
      await _client.patch('/expedients/$id/archive') as Map<String, dynamic>;

  /// Reabre un expediente cerrado o archivado (`PATCH /expedients/{id}/reopen`).
  Future<Map<String, dynamic>> reopen(String id) async =>
      await _client.patch('/expedients/$id/reopen') as Map<String, dynamic>;

  /// Transición genérica (`close`, `archive` o `reopen`), igual que la web (requiere `expedient:update`).
  Future<Map<String, dynamic>> transition(String id, String action) async =>
      await _client.patch('/expedients/$id/$action') as Map<String, dynamic>;

  /// Catálogo de tipos de expediente (`GET /expedient-types`).
  Future<Map<String, dynamic>> types({int size = 100}) async =>
      await _client.get('/expedient-types', query: {'page': 0, 'size': size}) as Map<String, dynamic>;

  /// Creación de un nuevo expediente / radicación (`POST /expedients`).
  Future<Map<String, dynamic>> create({
    required String code,
    required String name,
    required String expedientTypeId,
    String? description,
    String? departmentId,
    String? responsibleId,
    Map<String, dynamic> metadata = const {},
  }) async {
    final payload = <String, dynamic>{
      'code': code.trim(),
      'name': name.trim(),
      'expedientTypeId': expedientTypeId,
      if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
      if (departmentId != null && departmentId.trim().isNotEmpty) 'departmentId': departmentId,
      if (responsibleId != null && responsibleId.trim().isNotEmpty) 'responsibleId': responsibleId,
      'metadata': metadata,
    };
    return await _client.post('/expedients', payload) as Map<String, dynamic>;
  }

  // --- MÉTODOS FUERTEMENTE TIPADOS (Clean Architecture / SRP) ---

  /// Obtiene los expedientes tipados como [ExpedientModel].
  Future<List<ExpedientModel>> getExpedients({
    String? filter,
    String? status,
    int page = 0,
    int size = 20,
  }) async {
    final raw = await list(filter: filter, status: status, page: page, size: size);
    final rawList = raw['content'] as List<dynamic>? ?? [];
    final items = rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return items.map(ExpedientModel.fromJson).toList();
  }

  /// Obtiene el detalle de un expediente tipado como [ExpedientModel].
  Future<ExpedientModel> getExpedient(String id) async {
    final raw = await detail(id);
    return ExpedientModel.fromJson(raw);
  }

  /// Cierra un expediente y devuelve el modelo actualizado.
  Future<ExpedientModel> closeExpedient(String id) async {
    final raw = await close(id);
    return ExpedientModel.fromJson(raw);
  }

  /// Archiva un expediente y devuelve el modelo actualizado.
  Future<ExpedientModel> archiveExpedient(String id) async {
    final raw = await archive(id);
    return ExpedientModel.fromJson(raw);
  }

  /// Reabre un expediente y devuelve el modelo actualizado.
  Future<ExpedientModel> reopenExpedient(String id) async {
    final raw = await reopen(id);
    return ExpedientModel.fromJson(raw);
  }

  /// Obtiene el catálogo de tipos de expediente tipados.
  Future<List<ExpedientTypeModel>> getTypes() async {
    final raw = await types();
    final rawList = raw['content'] as List<dynamic>? ?? [];
    final items = rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return items.map(ExpedientTypeModel.fromJson).toList();
  }

  /// Radicación digital directa de solicitudes ciudadanas / PQRS.
  /// Crea el expediente con código único de radicación y, si hay soporte adjunto,
  /// crea el documento y carga la versión del archivo.
  Future<RadicacionResultModel> radicarSolicitud(RadicacionRequestModel request, {String? customCode}) async {
    final year = DateTime.now().year;
    final randomPart = (DateTime.now().millisecondsSinceEpoch % 900000) + 100000;
    final radCode = customCode ?? 'RAD-$year-$randomPart';

    final expRaw = await create(
      code: radCode,
      name: '${request.type.label}: ${request.title.trim()}',
      expedientTypeId: request.expedientTypeId,
      description: request.description.trim(),
      metadata: {
        'category': 'PQRS',
        'pqrsType': request.type.code,
        'source': 'MOBILE_APP',
        'citizen': request.citizen.toJson(),
        if (request.signatureHash != null && request.signatureHash!.isNotEmpty)
          'signatureHash': request.signatureHash,
        'participants': [
          {
            'source': 'CUSTOM',
            'name': request.citizen.name.trim(),
            'role': 'Solicitante (${request.citizen.docType} ${request.citizen.docNumber.trim()})',
          }
        ],
      },
    );

    final expId = expRaw['id'] as String;
    String? createdDocId;

    final docs = _documents;
    if (request.attachment != null && docs != null) {
      final docTypes = await docs.documentTypes();
      final docTypeId = docTypes.isNotEmpty ? (docTypes.first['id'] as String) : request.expedientTypeId;

      final docRaw = await docs.createDocument(
        name: 'Soporte_${request.type.code}_$radCode',
        documentTypeId: docTypeId,
        code: '$radCode-D01',
        description: 'Documento soporte adjunto en radicación digital',
      );

      final docId = docRaw['id'] as String?;
      if (docId != null) {
        createdDocId = docId;
        await docs.uploadVersion(
          docId,
          filePath: request.attachment!.path,
          fileName: request.attachment!.name,
          reason: 'Soporte digital adjunto en radicación',
        );
      }
    }

    return RadicacionResultModel(
      expedientId: expId,
      expedientCode: radCode,
      expedientName: '${request.type.label}: ${request.title.trim()}',
      documentId: createdDocId,
      createdAt: expRaw['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      signatureHash: request.signatureHash,
    );
  }

  /// Consulta ciudadana / externa sin autenticación para seguir el estado de un trámite por código.
  Future<PublicRadicacionModel> consultarRadicacionPublica({
    required String tenantId,
    required String code,
  }) async {
    final cleanCode = code.trim().toUpperCase();
    final raw = await _client.getPublic(
      '/public/radicaciones/$cleanCode',
      query: {'tenantId': tenantId.trim()},
    ) as Map<String, dynamic>;
    return PublicRadicacionModel.fromJson(raw);
  }
}
