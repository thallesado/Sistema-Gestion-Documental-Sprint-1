import 'package:flutter/foundation.dart';

/// Modelo de dominio inmutable para un evento de la bitácora de auditoría (`AuditEventResponse`).
@immutable
class AuditEventModel {
  const AuditEventModel({
    required this.id,
    required this.action,
    required this.entityType,
    this.entityId,
    required this.occurredAt,
    required this.result,
    this.ipAddress,
    this.userAgent,
    this.actorId,
    this.actorType,
    this.details = '{}',
    this.chainSeq,
    this.previousHash,
    this.recordHash,
  });

  factory AuditEventModel.fromJson(Map<String, dynamic> json) {
    final actor = json['actor'] as Map<String, dynamic>?;
    final rawDetails = json['details'];
    String detailsStr = '{}';
    if (rawDetails is String) {
      detailsStr = rawDetails;
    } else if (rawDetails != null) {
      detailsStr = rawDetails.toString();
    }

    return AuditEventModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      action: json['action'] as String? ?? 'EVENTO',
      entityType: json['entityType'] as String? ?? 'SYSTEM',
      entityId: json['entityId']?.toString(),
      occurredAt: DateTime.tryParse(json['occurredAt'] as String? ?? '') ?? DateTime.now(),
      result: json['result'] as String? ?? 'SUCCESS',
      ipAddress: json['ipAddress'] as String?,
      userAgent: json['userAgent'] as String?,
      actorId: (actor?['id'] ?? json['userId'] ?? json['platformActorId'])?.toString(),
      actorType: actor?['type'] as String? ?? (json['platformActorId'] != null ? 'PLATFORM' : 'TENANT'),
      details: detailsStr,
      chainSeq: (json['chainSeq'] as num?)?.toInt(),
      previousHash: (json['previousHash'] as String?)?.trim(),
      recordHash: (json['recordHash'] as String?)?.trim(),
    );
  }

  final int id;
  final String action;
  final String entityType;
  final String? entityId;
  final DateTime occurredAt;
  final String result;
  final String? ipAddress;
  final String? userAgent;
  final String? actorId;
  final String? actorType;
  final String details;
  final int? chainSeq;
  final String? previousHash;
  final String? recordHash;

  bool get isFailure => result.toUpperCase() == 'FAILURE';

  bool get isSuspicious =>
      isFailure ||
      action.toUpperCase().contains('DENIED') ||
      action.toUpperCase().contains('REJECT') ||
      action.toUpperCase().contains('DELETE') ||
      action.toUpperCase().contains('VOID') ||
      action.toUpperCase().contains('UNAUTHORIZED');

  /// Etiqueta amigable para no saturar la vista móvil con códigos técnicos.
  String get humanActionLabel {
    final upper = action.toUpperCase();
    if (upper.contains('LOGIN')) return 'Inicio de sesión';
    if (upper.contains('LOGOUT')) return 'Cierre de sesión';
    if (upper.contains('DOWNLOAD') || upper.contains('VERSION_DOWNLOAD')) return 'Descarga de versión documental';
    if (upper.contains('DOCUMENT_CREATE') || upper.contains('CREATE_DOCUMENT')) return 'Creación de documento';
    if (upper.contains('VERSION_UPLOAD') || upper.contains('UPLOAD')) return 'Carga de nueva versión';
    if (upper.contains('EXPEDIENT_CREATE') || upper.contains('RADICACION')) return 'Radicación de expediente';
    if (upper.contains('CLOSE')) return 'Cierre de trámite / expediente';
    if (upper.contains('APPROVE')) return 'Aprobación en flujo de trabajo';
    if (upper.contains('REJECT')) return 'Rechazo de tarea o trámite';
    if (upper.contains('STATUS') || upper.contains('TRANSITION')) return 'Cambio de estado';
    return action.replaceAll('_', ' ');
  }
}

/// Resultado de verificación criptográfica de la cadena SHA-256 (`AuditVerificationResult`).
@immutable
class AuditVerificationModel {
  const AuditVerificationModel({
    required this.valid,
    required this.totalVerified,
    this.brokenChainSeq,
    this.failureReason,
    this.anchored = false,
    this.anchorMatchesChain = true,
    this.verifiedAt,
  });

  factory AuditVerificationModel.fromJson(Map<String, dynamic> json) {
    final anchor = json['externalAnchorStatus'] as Map<String, dynamic>?;
    return AuditVerificationModel(
      valid: json['valid'] as bool? ?? true,
      totalVerified: (json['totalVerified'] as num?)?.toInt() ?? 0,
      brokenChainSeq: (json['brokenChainSeq'] as num?)?.toInt(),
      failureReason: json['failureReason'] as String?,
      anchored: anchor?['anchored'] as bool? ?? false,
      anchorMatchesChain: anchor?['anchorMatchesChain'] as bool? ?? true,
      verifiedAt: DateTime.tryParse(json['verifiedAt'] as String? ?? ''),
    );
  }

  final bool valid;
  final int totalVerified;
  final int? brokenChainSeq;
  final String? failureReason;
  final bool anchored;
  final bool anchorMatchesChain;
  final DateTime? verifiedAt;
}
