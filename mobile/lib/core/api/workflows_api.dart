import 'api_client.dart';

/// Tareas, acciones y avisos de workflows (base /workflows, igual que la web).
class WorkflowsApi {
  WorkflowsApi(this._client);

  final ApiClient _client;

  /// Filtros admitidos por el backend: status, overdue, dueSoon, today, stageType.
  Future<Map<String, dynamic>> tasks({Map<String, dynamic> filters = const {}, int size = 30}) async =>
      await _client.get('/workflows/tasks', query: {'page': 0, 'size': size, ...filters}) as Map<String, dynamic>;

  Future<Map<String, dynamic>> task(String id) async =>
      await _client.get('/workflows/tasks/$id') as Map<String, dynamic>;

  /// [action]: APPROVE, REVIEW, COMPLETE, REJECT o RETURN (mismo payload que la web).
  Future<Map<String, dynamic>?> act(
    String taskId,
    String action, {
    String? comment,
    String? returnStageId,
    Map<String, bool> checklist = const {},
  }) async =>
      await _client.post('/workflows/tasks/$taskId/actions', {
        'action': action,
        'comment': (comment == null || comment.trim().isEmpty) ? null : comment.trim(),
        'targetUserId': null,
        'returnStageId': returnStageId,
        'checklist': checklist,
      }) as Map<String, dynamic>?;

  Future<void> comment(String taskId, String text) => _client.post('/workflows/tasks/$taskId/comments', {'comment': text.trim()});

  Future<Map<String, dynamic>> notifications({int size = 50}) async =>
      await _client.get('/workflows/notifications', query: {'page': 0, 'size': size}) as Map<String, dynamic>;

  Future<void> markNotificationRead(String id) => _client.patch('/workflows/notifications/$id/read');
}
