import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

/// Modelo formal para el Comprobante Oficial de Radicación con sello digital de tiempo.
@immutable
class RadicacionReceiptModel {
  const RadicacionReceiptModel({
    required this.code,
    required this.tenantName,
    required this.radicacionType,
    required this.subject,
    required this.citizenName,
    required this.citizenDocumentType,
    required this.citizenDocumentNumber,
    required this.citizenEmail,
    required this.timestamp,
    required this.verificationHash,
    this.attachmentName,
    this.signatureHash,
    this.legalResponseDays = 15,
  });

  factory RadicacionReceiptModel.fromParameters({
    required String code,
    required String tenantName,
    required String radicacionType,
    required String subject,
    required String citizenName,
    required String citizenDocumentType,
    required String citizenDocumentNumber,
    required String citizenEmail,
    required DateTime timestamp,
    String? attachmentName,
    String? signatureHash,
    int legalResponseDays = 15,
  }) {
    // Generar hash de integridad SHA-256 del comprobante
    final rawSeed = '$code|$tenantName|$citizenDocumentNumber|${timestamp.toIso8601String()}|${signatureHash ?? ''}';
    final hash = sha256.convert(utf8.encode(rawSeed)).toString();

    return RadicacionReceiptModel(
      code: code,
      tenantName: tenantName,
      radicacionType: radicacionType,
      subject: subject,
      citizenName: citizenName,
      citizenDocumentType: citizenDocumentType,
      citizenDocumentNumber: citizenDocumentNumber,
      citizenEmail: citizenEmail,
      timestamp: timestamp,
      verificationHash: hash,
      attachmentName: attachmentName,
      signatureHash: signatureHash,
      legalResponseDays: legalResponseDays,
    );
  }

  final String code;
  final String tenantName;
  final String radicacionType;
  final String subject;
  final String citizenName;
  final String citizenDocumentType;
  final String citizenDocumentNumber;
  final String citizenEmail;
  final DateTime timestamp;
  final String verificationHash;
  final String? attachmentName;
  final String? signatureHash;
  final int legalResponseDays;

  /// Genera texto formateado legal del comprobante para compartir o guardar.
  String toFormalCertificateText() {
    final dateStr = timestamp.toLocal().toString().split('.').first;
    final buffer = StringBuffer();
    buffer.writeln('========================================================');
    buffer.writeln('       COMPROBANTE OFICIAL DE RADICACIÓN DIGITAL        ');
    buffer.writeln('             SISTEMA DE GESTIÓN NEXODOCS                ');
    buffer.writeln('========================================================');
    buffer.writeln('ENTIDAD RECEPTORA : $tenantName');
    buffer.writeln('CÓDIGO RADICACIÓN : $code');
    buffer.writeln('TIPO DE SOLICITUD : $radicacionType');
    buffer.writeln('FECHA Y HORA OFICIAL: $dateStr');
    buffer.writeln('CANAL DE RECEPCIÓN: Ventanilla Digital Móvil NexoDocs');
    buffer.writeln('--------------------------------------------------------');
    buffer.writeln('DATOS DEL SOLICITANTE:');
    buffer.writeln('Nombre Completo   : $citizenName');
    buffer.writeln('Identificación    : $citizenDocumentType $citizenDocumentNumber');
    buffer.writeln('Correo Notificación: $citizenEmail');
    buffer.writeln('--------------------------------------------------------');
    buffer.writeln('DETALLE DE LA SOLICITUD:');
    buffer.writeln('Asunto            : $subject');
    if (attachmentName != null && attachmentName!.isNotEmpty) {
      buffer.writeln('Soporte Adjunto   : $attachmentName (Digitalizado)');
    }
    buffer.writeln('Término Legal     : $legalResponseDays días hábiles');
    if (signatureHash != null && signatureHash!.isNotEmpty) {
      buffer.writeln('Firma Ciudadana   : $signatureHash');
    }
    buffer.writeln('--------------------------------------------------------');
    buffer.writeln('SELLO DIGITAL DE TIEMPO E INTEGRIDAD (SHA-256):');
    buffer.writeln(verificationHash);
    buffer.writeln('CÓDIGO QR DE VERIFICACIÓN: NEXODOCS|$code|${verificationHash.substring(0, 16)}');
    buffer.writeln('========================================================');
    buffer.writeln('Consulte el estado de su trámite en la app móvil');
    buffer.writeln('o en el portal web institucional con su código de radicación.');
    return buffer.toString();
  }
}
