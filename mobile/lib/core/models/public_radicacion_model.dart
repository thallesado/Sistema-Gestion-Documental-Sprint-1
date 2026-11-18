import 'package:flutter/foundation.dart';

/// Evento o hito en la cronología pública del trámite.
@immutable
class PublicRadicacionEventModel {
  const PublicRadicacionEventModel({
    required this.stageName,
    required this.description,
    required this.timestamp,
    required this.status,
  });

  factory PublicRadicacionEventModel.fromJson(Map<String, dynamic> json) {
    return PublicRadicacionEventModel(
      stageName: json['stageName'] as String? ?? 'Etapa de gestión',
      description: json['description'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
      status: json['status'] as String? ?? 'COMPLETED',
    );
  }

  final String stageName;
  final String description;
  final DateTime timestamp;
  final String status;
}

/// Respuesta de consulta pública y externa de radicación.
@immutable
class PublicRadicacionModel {
  const PublicRadicacionModel({
    required this.code,
    required this.tenantId,
    required this.tenantName,
    required this.subject,
    required this.type,
    required this.status,
    required this.statusLabel,
    required this.citizenName,
    required this.createdAt,
    required this.verificationHash,
    required this.summary,
    required this.events,
  });

  factory PublicRadicacionModel.fromJson(Map<String, dynamic> json) {
    final rawEvents = json['events'] as List<dynamic>? ?? [];
    return PublicRadicacionModel(
      code: json['code'] as String? ?? '',
      tenantId: json['tenantId'] as String? ?? '',
      tenantName: json['tenantName'] as String? ?? 'Entidad Pública',
      subject: json['subject'] as String? ?? 'Sin asunto',
      type: json['type'] as String? ?? 'Petición / Solicitud Ciudadana',
      status: json['status'] as String? ?? 'ACTIVE',
      statusLabel: json['statusLabel'] as String? ?? 'En Trámite',
      citizenName: json['citizenName'] as String? ?? 'Ciudadano Solicitante',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      verificationHash: json['verificationHash'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      events: rawEvents
          .map((e) => PublicRadicacionEventModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  final String code;
  final String tenantId;
  final String tenantName;
  final String subject;
  final String type;
  final String status;
  final String statusLabel;
  final String citizenName;
  final DateTime createdAt;
  final String verificationHash;
  final String summary;
  final List<PublicRadicacionEventModel> events;

  bool get isClosed => status == 'CLOSED';
  bool get isArchived => status == 'ARCHIVED';
  bool get isActive => status == 'ACTIVE';
}
