import '../models/workflow_instance_model.dart';
import '../models/workflow_task_model.dart';
import 'api_client.dart';

/// Tareas, acciones y avisos de workflows (base /workflows, igual que la web).
/// Ofrece compatibilidad con Map y métodos fuertemente tipados [WorkflowTaskModel].
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

  /// Lista procesos en ejecución (admite `documentId`, `status`, `bucket`, `search`, etc.).
  Future<Map<String, dynamic>> list({Map<String, dynamic> filters = const {}, int size = 20}) async =>
      await _client.get('/workflows', query: {'page': 0, 'size': size, ...filters}) as Map<String, dynamic>;

  /// Detalle completo del proceso con etapas, eventos, aprobaciones y participantes.
  Future<Map<String, dynamic>> detail(String id) async =>
      await _client.get('/workflows/$id') as Map<String, dynamic>;

  /// Historial cronológico de eventos del proceso.
  Future<Map<String, dynamic>> history(String id) async =>
      await _client.get('/workflows/$id/history') as Map<String, dynamic>;

  /// Catálogo de plantillas disponibles en el tenant.
  Future<Map<String, dynamic>> templates({Map<String, dynamic> filters = const {}, int size = 50}) async =>
      await _client.get('/workflows/templates', query: {'page': 0, 'size': size, ...filters}) as Map<String, dynamic>;

  /// Inicia un workflow a partir de una plantilla (`POST /workflows`).
  Future<Map<String, dynamic>> start({
    required String templateId,
    required String title,
    String? description,
    String? documentId,
    String? expedientId,
    String? departmentId,
    int priority = 2,
    String? dueAt,
    Map<String, String> assignments = const {},
  }) async =>
      await _client.post('/workflows', {
        'templateId': templateId,
        'title': title.trim(),
        'description': (description == null || description.trim().isEmpty) ? null : description.trim(),
        'documentId': documentId,
        'expedientId': expedientId,
        'departmentId': departmentId,
        'priority': priority,
        'dueAt': dueAt,
        'assignments': assignments,
      }) as Map<String, dynamic>;

  // --- MÉTODOS FUERTEMENTE TIPADOS (Clean Architecture / SRP) ---

  /// Lista de tareas modelada como [WorkflowTaskModel].
  Future<List<WorkflowTaskModel>> getTasks({Map<String, dynamic> filters = const {}, int size = 30}) async {
    final page = await tasks(filters: filters, size: size);
    final items = (page['content'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    return items.map(WorkflowTaskModel.fromJson).toList();
  }

  /// Tarea fuertemente tipada.
  Future<WorkflowTaskModel> getTask(String id) async {
    final raw = await task(id);
    return WorkflowTaskModel.fromJson(raw);
  }

  /// Avisos modelados como [WorkflowNotificationModel].
  Future<List<WorkflowNotificationModel>> getNotifications({int size = 50}) async {
    final page = await notifications(size: size);
    final items = (page['content'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    return items.map(WorkflowNotificationModel.fromJson).toList();
  }

  /// Lista los procesos de workflow asociados a un documento.
  Future<List<WorkflowInstanceModel>> getDocumentWorkflows(String documentId) async {
    final page = await list(filters: {'documentId': documentId});
    final rawList = page['content'] as List<dynamic>? ?? [];
    final items = rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return items.map(WorkflowInstanceModel.fromJson).toList();
  }

  /// Obtiene el detalle tipado del proceso con sus etapas y eventos.
  Future<WorkflowInstanceModel> getWorkflowDetail(String id) async {
    final raw = await detail(id);
    return WorkflowInstanceModel.fromJson(raw);
  }

  /// Plantillas activas compatibles con documentos (`ANY` o `DOCUMENT`).
  Future<List<WorkflowTemplateModel>> getDocumentTemplates() async {
    final page = await templates();
    final rawList = page['content'] as List<dynamic>? ?? [];
    final items = rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return items.map(WorkflowTemplateModel.fromJson).where((t) => t.supportsDocument).toList();
  }

  /// Inicia un workflow vinculado a un documento y devuelve su detalle tipado.
  Future<WorkflowInstanceModel> startDocumentWorkflow({
    required String templateId,
    required String title,
    String? description,
    required String documentId,
    int priority = 2,
  }) async {
    final raw = await start(
      templateId: templateId,
      title: title,
      description: description,
      documentId: documentId,
      priority: priority,
    );
    return WorkflowInstanceModel.fromJson(raw);
  }
}
