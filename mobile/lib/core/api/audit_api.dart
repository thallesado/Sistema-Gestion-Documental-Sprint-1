import '../models/audit_event_model.dart';
import 'api_client.dart';

/// Cliente API para consulta de pistas de auditoría e integridad criptográfica (`/api/v1/audit`).
class AuditApi {
  AuditApi(this._client);

  final ApiClient _client;

  /// Consulta paginada de eventos de auditoría con filtros opcionales.
  Future<List<AuditEventModel>> getEvents({
    String? action,
    String? type,
    String? result,
    int page = 0,
    int size = 25,
  }) async {
    final query = <String, dynamic>{
      'page': page,
      'size': size,
      if (action != null && action.trim().isNotEmpty) 'action': action.trim(),
      if (type != null && type.trim().isNotEmpty) 'type': type.trim(),
      if (result != null && result.trim().isNotEmpty) 'result': result.trim(),
    };
    final res = await _client.get('/audit', query: query) as Map<String, dynamic>;
    final content = (res['content'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    return content.map(AuditEventModel.fromJson).toList();
  }

  /// Verifica en tiempo real la integridad de la cadena de hashes SHA-256 del tenant.
  Future<AuditVerificationModel> verifyChain() async {
    final res = await _client.get('/audit/verify') as Map<String, dynamic>;
    return AuditVerificationModel.fromJson(res);
  }
}
