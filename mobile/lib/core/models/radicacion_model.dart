import 'package:flutter/foundation.dart';

/// Tipos de solicitudes ciudadanas / PQRS.
enum RadicacionType {
  peticion('PETICION', 'Petición', 'Solicitud formal de información o trámite'),
  queja('QUEJA', 'Queja', 'Manifestación de inconformidad con un servicio'),
  reclamo('RECLAMO', 'Reclamo', 'Exigencia por una prestación indebida o deficiente'),
  sugerencia('SUGERENCIA', 'Sugerencia', 'Propuesta de mejora para la entidad'),
  tramite('TRAMITE', 'Trámite general', 'Radicación general de documentos o solicitudes');

  const RadicacionType(this.code, this.label, this.description);

  final String code;
  final String label;
  final String description;
}

/// Datos del solicitante / ciudadano que radica.
@immutable
class RadicacionCitizenModel {
  const RadicacionCitizenModel({
    required this.name,
    required this.docType,
    required this.docNumber,
    required this.email,
    required this.phone,
  });

  final String name;
  final String docType;
  final String docNumber;
  final String email;
  final String phone;

  Map<String, dynamic> toJson() => {
        'name': name,
        'docType': docType,
        'docNumber': docNumber,
        'email': email,
        'phone': phone,
      };
}

/// Archivo o evidencia de soporte adjunto en la radicación.
@immutable
class RadicacionAttachmentModel {
  const RadicacionAttachmentModel({
    required this.path,
    required this.name,
    required this.sizeBytes,
    this.isImage = false,
  });

  final String path;
  final String name;
  final int sizeBytes;
  final bool isImage;
}

/// Solicitud completa de radicación digital ciudadana.
@immutable
class RadicacionRequestModel {
  const RadicacionRequestModel({
    required this.type,
    required this.title,
    required this.description,
    required this.expedientTypeId,
    required this.citizen,
    this.attachment,
    this.signatureHash,
  });

  final RadicacionType type;
  final String title;
  final String description;
  final String expedientTypeId;
  final RadicacionCitizenModel citizen;
  final RadicacionAttachmentModel? attachment;
  final String? signatureHash;
}

/// Resultado de una radicación exitosa con código único asignado.
@immutable
class RadicacionResultModel {
  const RadicacionResultModel({
    required this.expedientId,
    required this.expedientCode,
    required this.expedientName,
    this.documentId,
    required this.createdAt,
    this.signatureHash,
  });

  final String expedientId;
  final String expedientCode;
  final String expedientName;
  final String? documentId;
  final String createdAt;
  final String? signatureHash;
}
