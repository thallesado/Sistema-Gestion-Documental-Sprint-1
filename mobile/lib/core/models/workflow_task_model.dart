/// Modelo de dominio para tareas de workflow en NexoDocs.
class WorkflowTaskModel {
  const WorkflowTaskModel({
    required this.id,
    required this.title,
    required this.status,
    this.stageType,
    this.stageId,
    this.stageName,
    this.priority = 1,
    this.dueAt,
    this.isOverdue = false,
    this.workflowTitle,
    this.workflowCode,
    this.canAct = false,
    this.checklistItems = const [],
    this.comments = const [],
    this.stages = const [],
    this.rules = const {},
    this.rawJson = const {},
  });

  factory WorkflowTaskModel.fromJson(Map<String, dynamic> json) {
    return WorkflowTaskModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Sin título',
      status: json['status'] as String? ?? 'PENDING',
      stageType: json['stage_type'] as String? ?? json['stageType'] as String?,
      stageId: json['stage_id'] as String? ?? json['stageId'] as String?,
      stageName: json['stage_name'] as String? ?? json['stageName'] as String?,
      priority: json['priority'] as int? ?? 1,
      dueAt: json['due_at'] != null
          ? DateTime.tryParse(json['due_at'] as String)
          : (json['dueAt'] != null ? DateTime.tryParse(json['dueAt'] as String) : null),
      isOverdue: json['overdue'] as bool? ?? false,
      workflowTitle: json['workflow_title'] as String? ?? json['workflowTitle'] as String?,
      workflowCode: json['workflow_code'] as String? ?? json['workflowCode'] as String?,
      canAct: json['can_act'] as bool? ?? (json['canAct'] as bool? ?? false),
      checklistItems: (json['checklist_items'] as List<dynamic>? ?? json['checklistItems'] as List<dynamic>? ?? [])
          .cast<dynamic>(),
      comments: (json['comments'] as List<dynamic>? ?? []).cast<dynamic>(),
      stages: (json['stages'] as List<dynamic>? ?? []).cast<dynamic>(),
      rules: (json['rules'] as Map<String, dynamic>? ?? const {}),
      rawJson: json,
    );
  }

  final String id;
  final String title;
  final String status;
  final String? stageType;
  final String? stageId;
  final String? stageName;
  final int priority;
  final DateTime? dueAt;
  final bool isOverdue;
  final String? workflowTitle;
  final String? workflowCode;
  final bool canAct;
  final List<dynamic> checklistItems;
  final List<dynamic> comments;
  final List<dynamic> stages;
  final Map<String, dynamic> rules;
  final Map<String, dynamic> rawJson;

  dynamic operator [](String key) => rawJson[key];

  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isInProgress => status.toUpperCase() == 'IN_PROGRESS';
  bool get isCompleted => status.toUpperCase() == 'COMPLETED';

  String get priorityLabel => switch (priority) {
        1 => 'Alta',
        2 => 'Media',
        _ => 'Baja',
      };

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'title': title,
          'status': status,
          'stage_type': stageType,
          'stage_id': stageId,
          'priority': priority,
          'due_at': dueAt?.toIso8601String(),
          'overdue': isOverdue,
          'workflow_title': workflowTitle,
          'workflow_code': workflowCode,
          'can_act': canAct,
        };
}

/// Aviso / Notificación de workflow.
class WorkflowNotificationModel {
  const WorkflowNotificationModel({
    required this.id,
    required this.title,
    required this.message,
    this.taskId,
    this.isRead = false,
    this.createdAt,
    this.rawJson = const {},
  });

  factory WorkflowNotificationModel.fromJson(Map<String, dynamic> json) {
    return WorkflowNotificationModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Aviso',
      message: json['message'] as String? ?? '',
      taskId: json['task_id'] as String? ?? json['taskId'] as String?,
      isRead: json['is_read'] as bool? ?? (json['isRead'] as bool? ?? false),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : (json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null),
      rawJson: json,
    );
  }

  final String id;
  final String title;
  final String message;
  final String? taskId;
  final bool isRead;
  final DateTime? createdAt;
  final Map<String, dynamic> rawJson;

  dynamic operator [](String key) => rawJson[key];

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'title': title,
          'message': message,
          'task_id': taskId,
          'is_read': isRead,
          'created_at': createdAt?.toIso8601String(),
        };
}
