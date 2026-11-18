import 'package:flutter/foundation.dart';
import '../models/radicacion_model.dart';

/// Datos estructurados extraídos de un trabajo OCR para autocompletar radicaciones sin tecleo.
@immutable
class OcrRadicacionPreFill {
  const OcrRadicacionPreFill({
    required this.radicacionType,
    required this.citizenName,
    required this.citizenDocType,
    required this.citizenDocNumber,
    required this.subject,
    required this.description,
    required this.detectedDocumentClass,
    this.issueDate,
    this.amountOrReference,
    this.scannedFilePath,
    this.scannedFileName,
    this.scannedFileSize,
  });

  final RadicacionType radicacionType;
  final String citizenName;
  final String citizenDocType;
  final String citizenDocNumber;
  final String subject;
  final String description;
  final String detectedDocumentClass;
  final String? issueDate;
  final String? amountOrReference;
  final String? scannedFilePath;
  final String? scannedFileName;
  final int? scannedFileSize;
}

/// Extractor inteligente de metadatos a partir de la respuesta de `/api/v1/ocr/process`.
/// Detecta cédulas, facturas, contratos o documentos clínicos para radicar sin tecleo manual.
abstract final class OcrFieldExtractor {
  static OcrRadicacionPreFill extractFromJob(
    Map<String, dynamic> job, {
    String? filePath,
    String? fileName,
    int? fileSize,
  }) {
    final rawDocType = (job['documentType'] as String? ?? 'DOCUMENTO').trim();
    final upperType = rawDocType.toUpperCase();
    final summary = (job['extractedSummary'] as String? ?? '').trim();
    final patientName = (job['patientName'] as String? ?? '').trim();
    final patientDni = (job['patientDocumentNumber'] as String? ?? '').trim();
    final doctorName = (job['doctorName'] as String? ?? '').trim();
    final issueDate = (job['issueDate'] as String? ?? '').trim();

    // Clasificación semántica de documento (Factura, Cédula, Contrato, Solicitud)
    String docClass = rawDocType;
    RadicacionType radType = RadicacionType.tramite;
    String docIdType = 'CC';

    if (upperType.contains('FACTURA') || summary.toUpperCase().contains('FACTURA') || summary.toUpperCase().contains('NIT')) {
      docClass = 'Factura / Cuenta de Cobro';
      radType = RadicacionType.tramite;
      if (summary.toUpperCase().contains('NIT')) docIdType = 'NIT';
    } else if (upperType.contains('CEDULA') || upperType.contains('IDENTIFICACION') || summary.toUpperCase().contains('CEDULA')) {
      docClass = 'Cédula / Documento de Identidad';
      radType = RadicacionType.peticion;
    } else if (upperType.contains('CONTRATO') || summary.toUpperCase().contains('CONTRATO')) {
      docClass = 'Contrato / Convenio';
      radType = RadicacionType.tramite;
    } else if (upperType.contains('QUEJA') || summary.toUpperCase().contains('QUEJA')) {
      docClass = 'Queja Formal';
      radType = RadicacionType.queja;
    } else if (upperType.contains('RECLAMO') || summary.toUpperCase().contains('RECLAMO')) {
      docClass = 'Reclamo Ciudadano';
      radType = RadicacionType.reclamo;
    } else {
      radType = RadicacionType.peticion;
    }

    // Extracción de nombre o razón social
    String extractedName = patientName;
    if (extractedName.isEmpty && doctorName.isNotEmpty) {
      extractedName = doctorName;
    }

    // Extracción de documento / NIT mediante expresión regular si no vino en patientDocumentNumber
    String extractedDocNumber = patientDni;
    if (extractedDocNumber.isEmpty && summary.isNotEmpty) {
      final idMatch = RegExp(r'\b(\d{6,12}(-\d)?)\b').firstMatch(summary);
      if (idMatch != null) {
        extractedDocNumber = idMatch.group(1)!;
      }
    }

    // Extracción de monto o referencia si es factura/contrato
    String? amountOrRef;
    if (summary.isNotEmpty) {
      final moneyMatch = RegExp(r'(\$\s?[\d.,]+|\bCOP\s?[\d.,]+|\bUSD\s?[\d.,]+)').firstMatch(summary);
      if (moneyMatch != null) {
        amountOrRef = moneyMatch.group(1);
      }
    }

    // Construcción de asunto y descripción claros sin tecleo
    final subjectParts = <String>[docClass];
    if (extractedName.isNotEmpty) subjectParts.add(extractedName);
    if (issueDate.isNotEmpty) subjectParts.add('($issueDate)');
    final builtSubject = subjectParts.join(' - ');

    final descBuffer = StringBuffer();
    if (summary.isNotEmpty) {
      descBuffer.writeln(summary);
    } else {
      descBuffer.writeln('Radicación originada por digitalización OCR automática de $docClass.');
    }
    if (issueDate.isNotEmpty) descBuffer.writeln('Fecha documento: $issueDate.');
    if (amountOrRef != null) descBuffer.writeln('Valor / Referencia detectada: $amountOrRef.');

    return OcrRadicacionPreFill(
      radicacionType: radType,
      citizenName: extractedName,
      citizenDocType: docIdType,
      citizenDocNumber: extractedDocNumber,
      subject: builtSubject,
      description: descBuffer.toString().trim(),
      detectedDocumentClass: docClass,
      issueDate: issueDate.isEmpty ? null : issueDate,
      amountOrReference: amountOrRef,
      scannedFilePath: filePath,
      scannedFileName: fileName,
      scannedFileSize: fileSize,
    );
  }
}
