import 'api_client.dart';

/// Expedientes: mismos endpoints que ExpedientApiService de la web (base /expedients).
class ExpedientsApi {
  ExpedientsApi(this._client);

  final ApiClient _client;

  /// [status]: ACTIVE, CLOSED, ARCHIVED o BLOCKED; `null` = todos.
  Future<List<Map<String, dynamic>>> list({String? filter, String? status, int size = 50}) async {
    final body = await _client.get('/expedients', query: {
      'page': 0,
      'size': size,
      'filter': filter,
      'status': status,
    }) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> detail(String id) async => await _client.get('/expedients/$id') as Map<String, dynamic>;

  /// Requiere `expedient:create`; código y nombre son obligatorios en el servidor.
  Future<Map<String, dynamic>> create({
    required String expedientTypeId,
    required String code,
    required String name,
    String? description,
    String? departmentId,
  }) async =>
      await _client.post('/expedients', {
        'expedientTypeId': expedientTypeId,
        'code': code.trim(),
        'name': name.trim(),
        if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
        if (departmentId != null && departmentId.isNotEmpty) 'departmentId': departmentId,
      }) as Map<String, dynamic>;

  /// Tipos de expediente (el backend los expone a quien puede crear expedientes).
  Future<List<Map<String, dynamic>>> types() async {
    final body = await _client.get('/expedient-types', query: {'size': 100});
    if (body is List) return body.cast<Map<String, dynamic>>();
    return ((body as Map<String, dynamic>)['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  /// [action]: `close`, `archive` o `reopen` (requiere `expedient:update`).
  Future<Map<String, dynamic>> transition(String id, String action) async =>
      await _client.patch('/expedients/$id/$action') as Map<String, dynamic>;
}
