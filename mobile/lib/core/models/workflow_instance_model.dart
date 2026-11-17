/// Modelos de dominio para plantillas, instancias y seguimiento de workflows.
class WorkflowTemplateModel {
  const WorkflowTemplateModel({
    required this.id,
    required this.name,
    this.description,
    this.category,
    this.originType = 'ANY',
    this.isActive = true,
    this.publicationStatus,
    this.stepsCount = 0,
    this.estimatedDays = 0,
    this.rawJson = const {},
  });

  factory WorkflowTemplateModel.fromJson(Map<String, dynamic> json) {
    return WorkflowTemplateModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Plantilla sin nombre',
      description: json['description'] as String?,
      category: json['category'] as String?,
      originType: (json['origin_type'] as String? ?? json['originType'] as String? ?? 'ANY').toUpperCase(),
      isActive: json['is_active'] as bool? ?? (json['active'] as bool? ?? true),
      publicationStatus: json['publication_status'] as String? ?? json['publicationStatus'] as String?,
      stepsCount: (json['steps'] as num?)?.toInt() ?? 0,
      estimatedDays: (json['estimated_days'] as num? ?? json['estimatedDays'] as num?)?.toInt() ?? 0,
      rawJson: json,
    );
  }

  final String id;
  final String name;
  final String? description;
  final String? category;
  final String originType;
  final bool isActive;
  final String? publicationStatus;
  final int stepsCount;
  final int estimatedDays;
  final Map<String, dynamic> rawJson;

  bool get supportsDocument => isActive && (originType == 'ANY' || originType == 'DOCUMENT');

  dynamic operator [](String key) => rawJson[key];
}

class WorkflowStageProgressModel {
  const WorkflowStageProgressModel({
    required this.id,
    required this.name,
    required this.stageType,
    required this.sortOrder,
    this.dueDays,
    required this.state,
  });

  factory WorkflowStageProgressModel.fromJson(Map<String, dynamic> json, {required String state}) {
    return WorkflowStageProgressModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Etapa',
      stageType: json['stage_type'] as String? ?? json['stageType'] as String? ?? 'TASK',
      sortOrder: (json['sort_order'] as num? ?? json['sortOrder'] as num?)?.toInt() ?? 0,
      dueDays: (json['due_days'] as num? ?? json['dueDays'] as num?)?.toInt(),
      state: state,
    );
  }

  final String id;
  final String name;
  final String stageType;
  final int sortOrder;
  final int? dueDays;

  /// `'COMPLETED'`, `'CURRENT'`, `'PENDING'` o `'REJECTED'`.
  final String state;
}

class WorkflowEventModel {
  const WorkflowEventModel({
    required this.id,
    required this.eventType,
    this.result,
    this.comment,
    this.actorName,
    this.performedAt,
    this.rawJson = const {},
  });

  factory WorkflowEventModel.fromJson(Map<String, dynamic> json) {
    final performed = json['performed_at'] as String? ?? json['performedAt'] as String?;
    return WorkflowEventModel(
      id: json['id'] as String? ?? '',
      eventType: json['event_type'] as String? ?? json['eventType'] as String? ?? 'EVENT',
      result: json['result'] as String?,
      comment: json['comment'] as String?,
      actorName: json['actor_name'] as String? ?? json['actorName'] as String?,
      performedAt: performed != null ? DateTime.tryParse(performed) : null,
      rawJson: json,
    );
  }

  final String id;
  final String eventType;
  final String? result;
  final String? comment;
  final String? actorName;
  final DateTime? performedAt;
  final Map<String, dynamic> rawJson;

  dynamic operator [](String key) => rawJson[key];
}

class WorkflowInstanceModel {
  const WorkflowInstanceModel({
    required this.id,
    required this.code,
    required this.title,
    this.description,
    required this.status,
    this.templateName,
    this.templateVersion,
    this.creatorName,
    this.stageName,
    this.stageType,
    this.currentStageId,
    this.documentId,
    this.documentName,
    this.documentCode,
    this.totalSteps = 0,
    this.completedSteps = 0,
    this.progress = 0,
    this.responsibleName,
    this.departmentName,
    this.finalApproverName,
    this.priority = 2,
    this.dueAt,
    this.startedAt,
    this.completedAt,
    this.stages = const [],
    this.events = const [],
    this.rawJson = const {},
  });

  factory WorkflowInstanceModel.fromJson(Map<String, dynamic> json) {
    final status = (json['status'] as String? ?? 'IN_PROGRESS').toUpperCase();
    final currentStageId = json['current_stage_id'] as String? ?? json['currentStageId'] as String?;
    final rawStages = ((json['stages'] as List<dynamic>?) ?? []).whereType<Map<String, dynamic>>().toList();
    final rawEvents = ((json['events'] as List<dynamic>?) ?? []).whereType<Map<String, dynamic>>().toList();

    int? currentOrder;
    if (currentStageId != null) {
      for (final stage in rawStages) {
        if (stage['id'] == currentStageId) {
          currentOrder = (stage['sort_order'] as num? ?? stage['sortOrder'] as num?)?.toInt();
          break;
        }
      }
    }

    final parsedStages = <WorkflowStageProgressModel>[];
    for (final stage in rawStages) {
      final type = (stage['stage_type'] as String? ?? stage['stageType'] as String? ?? '').toUpperCase();
      if (type == 'START' || type == 'END') continue;
      final id = stage['id'] as String? ?? '';
      final order = (stage['sort_order'] as num? ?? stage['sortOrder'] as num?)?.toInt() ?? 0;

      late final String state;
      if (status == 'COMPLETED') {
        state = 'COMPLETED';
      } else if (id == currentStageId) {
        state = (status == 'REJECTED' || status == 'CANCELED') ? 'REJECTED' : 'CURRENT';
      } else if (currentOrder != null && order < currentOrder) {
        state = 'COMPLETED';
      } else {
        state = 'PENDING';
      }

      parsedStages.add(WorkflowStageProgressModel.fromJson(stage, state: state));
    }

    final parsedEvents = rawEvents.map(WorkflowEventModel.fromJson).toList();

    DateTime? parseDate(Object? v) => v is String ? DateTime.tryParse(v) : null;

    return WorkflowInstanceModel(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      title: json['title'] as String? ?? 'Trámite sin título',
      description: json['description'] as String?,
      status: status,
      templateName: json['template_name'] as String? ?? json['templateName'] as String?,
      templateVersion: (json['template_version'] as num? ?? json['templateVersion'] as num?)?.toInt(),
      creatorName: json['creator_name'] as String? ?? json['creatorName'] as String?,
      stageName: json['stage_name'] as String? ?? json['stageName'] as String?,
      stageType: json['stage_type'] as String? ?? json['stageType'] as String?,
      currentStageId: currentStageId,
      documentId: json['document_id'] as String? ?? json['documentId'] as String?,
      documentName: json['document_name'] as String? ?? json['documentName'] as String?,
      documentCode: json['document_code'] as String? ?? json['documentCode'] as String?,
      totalSteps: (json['total_steps'] as num? ?? json['totalSteps'] as num?)?.toInt() ?? 0,
      completedSteps: (json['completed_steps'] as num? ?? json['completedSteps'] as num?)?.toInt() ?? 0,
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      responsibleName: json['responsible_name'] as String? ?? json['responsibleName'] as String?,
      departmentName: json['department_name'] as String? ?? json['departmentName'] as String?,
      finalApproverName: json['final_approver_name'] as String? ?? json['finalApproverName'] as String?,
      priority: (json['priority'] as num?)?.toInt() ?? 2,
      dueAt: parseDate(json['due_at'] ?? json['dueAt']),
      startedAt: parseDate(json['started_at'] ?? json['startedAt']),
      completedAt: parseDate(json['completed_at'] ?? json['completedAt']),
      stages: parsedStages,
      events: parsedEvents,
      rawJson: json,
    );
  }

  final String id;
  final String code;
  final String title;
  final String? description;
  final String status;
  final String? templateName;
  final int? templateVersion;
  final String? creatorName;
  final String? stageName;
  final String? stageType;
  final String? currentStageId;
  final String? documentId;
  final String? documentName;
  final String? documentCode;
  final int totalSteps;
  final int completedSteps;
  final int progress;
  final String? responsibleName;
  final String? departmentName;
  final String? finalApproverName;
  final int priority;
  final DateTime? dueAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final List<WorkflowStageProgressModel> stages;
  final List<WorkflowEventModel> events;
  final Map<String, dynamic> rawJson;

  bool get isActive => ['STARTED', 'IN_PROGRESS', 'PAUSED'].contains(status.toUpperCase());
  bool get isCompleted => status.toUpperCase() == 'COMPLETED';
  bool get isRejected => status.toUpperCase() == 'REJECTED';

  dynamic operator [](String key) => rawJson[key];
}
