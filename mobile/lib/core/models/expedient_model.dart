import 'package:flutter/foundation.dart';

/// Modelo de dominio inmutable para un participante registrado en un expediente.
@immutable
class ExpedientParticipantModel {
  const ExpedientParticipantModel({
    required this.source,
    required this.name,
    required this.role,
    this.sourceId,
  });

  factory ExpedientParticipantModel.fromJson(Map<String, dynamic> json) {
    return ExpedientParticipantModel(
      source: (json['source'] as String?)?.toUpperCase() ?? 'CUSTOM',
      name: (json['name'] as String?) ?? '',
      role: (json['role'] as String?) ?? '',
      sourceId: json['sourceId'] as String?,
    );
  }

  final String source; // USER, PATIENT, CUSTOM
  final String name;
  final String role;
  final String? sourceId;

  Map<String, dynamic> toJson() => {
        'source': source,
        'name': name,
        'role': role,
        if (sourceId != null) 'sourceId': sourceId,
      };
}

/// Modelo de dominio inmutable para una Unidad Documental / Expediente Digital.
/// Representa una radicación que agrupa múltiples documentos y workflows.
@immutable
class ExpedientModel {
  const ExpedientModel({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    required this.status,
    this.expedientTypeId,
    this.responsibleId,
    this.departmentId,
    this.metadata = const {},
    this.closedAt,
    this.archivedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ExpedientModel.fromJson(Map<String, dynamic> json) {
    final meta = (json['metadata'] as Map<String, dynamic>?) ?? const {};
    return ExpedientModel(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      status: (json['status'] as String?)?.toUpperCase() ?? 'ACTIVE',
      expedientTypeId: json['expedientTypeId'] as String?,
      responsibleId: json['responsibleId'] as String?,
      departmentId: json['departmentId'] as String?,
      metadata: meta,
      closedAt: json['closedAt'] as String?,
      archivedAt: json['archivedAt'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  final String id;
  final String code;
  final String name;
  final String? description;
  final String status; // ACTIVE, CLOSED, ARCHIVED, BLOCKED
  final String? expedientTypeId;
  final String? responsibleId;
  final String? departmentId;
  final Map<String, dynamic> metadata;
  final String? closedAt;
  final String? archivedAt;
  final String createdAt;
  final String updatedAt;

  bool get isActive => status == 'ACTIVE';
  bool get isClosed => status == 'CLOSED';
  bool get isArchived => status == 'ARCHIVED';
  bool get isBlocked => status == 'BLOCKED';

  List<ExpedientParticipantModel> get participants {
    final raw = metadata['participants'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(ExpedientParticipantModel.fromJson)
        .toList();
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'name': name,
        'description': description,
        'status': status,
        'expedientTypeId': expedientTypeId,
        'responsibleId': responsibleId,
        'departmentId': departmentId,
        'metadata': metadata,
        'closedAt': closedAt,
        'archivedAt': archivedAt,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

/// Modelo para los tipos de expediente del catálogo.
@immutable
class ExpedientTypeModel {
  const ExpedientTypeModel({
    required this.id,
    required this.code,
    required this.name,
  });

  factory ExpedientTypeModel.fromJson(Map<String, dynamic> json) {
    return ExpedientTypeModel(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }

  final String id;
  final String code;
  final String name;

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'name': name,
      };
}
