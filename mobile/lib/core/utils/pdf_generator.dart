import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import '../models/radicacion_receipt_model.dart';

/// Generador nativo en Dart puro de documentos PDF estándar (Especificación PDF 1.4).
/// No requiere librerías nativas externas y produce un archivo `.pdf` real y válido.
abstract final class PdfGenerator {
  /// Construye los bytes de un documento PDF 1.4 con las líneas de texto proporcionadas.
  static Uint8List buildOfficialPdfBytes({
    required String title,
    required String subtitle,
    required List<String> lines,
    required String verificationHash,
    String? signatureHash,
  }) {
    String sanitize(String input) {
      return input
          .replaceAll('á', 'a')
          .replaceAll('é', 'e')
          .replaceAll('í', 'i')
          .replaceAll('ó', 'o')
          .replaceAll('ú', 'u')
          .replaceAll('Á', 'A')
          .replaceAll('É', 'E')
          .replaceAll('Í', 'I')
          .replaceAll('Ó', 'O')
          .replaceAll('Ú', 'U')
          .replaceAll('ñ', 'n')
          .replaceAll('Ñ', 'N')
          .replaceAll('ü', 'u')
          .replaceAll('Ü', 'U')
          .replaceAll('·', '-')
          .replaceAll('(', '[')
          .replaceAll(')', ']')
          .replaceAll('\\', '/');
    }

    final streamBuffer = StringBuffer();
    // Cabecera gráfica institucional
    streamBuffer.writeln('0.03 0.50 0.48 rg');
    streamBuffer.writeln('40 760 515 45 re f');
    streamBuffer.writeln('BT');
    streamBuffer.writeln('/F1 14 Tf');
    streamBuffer.writeln('1 1 1 rg');
    streamBuffer.writeln('52 784 Td');
    streamBuffer.writeln('(${sanitize(title)}) Tj');
    streamBuffer.writeln('/F1 9 Tf');
    streamBuffer.writeln('0 -14 Td');
    streamBuffer.writeln('(${sanitize(subtitle)}) Tj');
    streamBuffer.writeln('ET');

    // Cuerpo del documento
    streamBuffer.writeln('BT');
    streamBuffer.writeln('0.1 0.14 0.2 rg');
    streamBuffer.writeln('/F1 10 Tf');
    int y = 730;
    streamBuffer.writeln('48 $y Td');

    for (final rawLine in lines) {
      final clean = sanitize(rawLine);
      streamBuffer.writeln('($clean) Tj');
      streamBuffer.writeln('0 -16 Td');
      y -= 16;
      if (y < 120) break;
    }

    // Sello de integridad y QR textual
    streamBuffer.writeln('0 -8 Td');
    streamBuffer.writeln('(--------------------------------------------------------------------------) Tj');
    streamBuffer.writeln('0 -14 Td');
    streamBuffer.writeln('(SELLO CRIPTOGRAFICO DE TIEMPO E INTEGRIDAD [SHA-256]:) Tj');
    streamBuffer.writeln('0 -14 Td');
    streamBuffer.writeln('(${sanitize(verificationHash)}) Tj');
    if (signatureHash != null && signatureHash.isNotEmpty) {
      streamBuffer.writeln('0 -14 Td');
      streamBuffer.writeln('(FIRMA DIGITAL DEL SOLICITANTE [SHA-256]:) Tj');
      streamBuffer.writeln('0 -14 Td');
      streamBuffer.writeln('(${sanitize(signatureHash)}) Tj');
    }
    streamBuffer.writeln('0 -16 Td');
    streamBuffer.writeln('(Documento oficial generado por NexoDocs Mobile con validez probatoria.) Tj');
    streamBuffer.writeln('ET');

    final contentStream = streamBuffer.toString();
    final contentBytes = ascii.encode(contentStream);

    final objects = <String>[
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      '5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n$contentStream\nendstream\nendobj\n',
    ];

    final pdfBuffer = StringBuffer();
    pdfBuffer.write('%PDF-1.4\n');
    final offsets = <int>[];

    for (final obj in objects) {
      offsets.add(pdfBuffer.toString().length);
      pdfBuffer.write(obj);
    }

    final xrefOffset = pdfBuffer.toString().length;
    pdfBuffer.write('xref\n');
    pdfBuffer.write('0 ${objects.length + 1}\n');
    pdfBuffer.write('0000000000 65535 f \n');
    for (final offset in offsets) {
      pdfBuffer.write('${offset.toString().padLeft(10, '0')} 00000 n \n');
    }
    pdfBuffer.write('trailer\n');
    pdfBuffer.write('<< /Size ${objects.length + 1} /Root 1 0 R >>\n');
    pdfBuffer.write('startxref\n');
    pdfBuffer.write('$xrefOffset\n');
    pdfBuffer.write('%%EOF\n');

    return Uint8List.fromList(ascii.encode(pdfBuffer.toString()));
  }

  /// Genera y guarda en almacenamiento local el PDF oficial de un comprobante de radicación.
  static Future<File> saveRadicacionReceiptPdf(RadicacionReceiptModel receipt) async {
    final dateStr = receipt.timestamp.toLocal().toString().split('.').first;
    final lines = <String>[
      'ENTIDAD RECEPTORA   : ${receipt.tenantName.toUpperCase()}',
      'NUMERO RADICACION   : ${receipt.code}',
      'FECHA Y HORA OFICIAL: $dateStr',
      'TIPO DE TRAMITE     : ${receipt.radicacionType}',
      'TERMINO DE RESPUESTA: ${receipt.legalResponseDays} dias habiles',
      '--------------------------------------------------------------------------',
      'DATOS DEL SOLICITANTE:',
      'Nombre / Razon Soc. : ${receipt.citizenName}',
      'Identificacion      : ${receipt.citizenDocumentType} ${receipt.citizenDocumentNumber}',
      'Correo Notificacion : ${receipt.citizenEmail}',
      '--------------------------------------------------------------------------',
      'DETALLE DE LA RADICACION:',
      'Asunto              : ${receipt.subject}',
      if (receipt.attachmentName != null && receipt.attachmentName!.isNotEmpty)
        'Soporte Adjunto     : ${receipt.attachmentName}',
      'Estado de Firma     : ${receipt.signatureHash != null ? 'FIRMADO DIGITALMENTE POR EL CIUDADANO' : 'SELLO AUTOMATICO DE VENTANILLA'}',
      'Verificacion QR     : NEXODOCS|${receipt.code}|${receipt.verificationHash.substring(0, 16)}',
    ];

    final bytes = buildOfficialPdfBytes(
      title: 'COMPROBANTE OFICIAL DE RADICACION - ${receipt.code}',
      subtitle: '${receipt.tenantName} · Ventanilla Unica Digital NexoDocs',
      lines: lines,
      verificationHash: receipt.verificationHash,
      signatureHash: receipt.signatureHash,
    );

    Directory dir;
    try {
      dir = await getTemporaryDirectory();
    } catch (_) {
      dir = Directory.systemTemp;
    }
    final safeCode = receipt.code.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final file = File('${dir.path}${Platform.pathSeparator}Comprobante_$safeCode.pdf');
    file.writeAsBytesSync(bytes, flush: true);
    return file;
  }

  /// Genera y guarda en almacenamiento local el Certificado PDF con QR para un documento aprobado.
  static Future<File> saveDocumentCertificatePdf({
    required String code,
    required String name,
    required String status,
    required String authorName,
    required String versionNumber,
    required String updatedAt,
    required String verificationHash,
  }) async {
    final lines = <String>[
      'CODIGO DOCUMENTAL   : $code',
      'TITULO DEL DOCUMENTO: $name',
      'ESTADO OFICIAL      : $status',
      'VERSION VIGENTE     : v$versionNumber',
      'AUTOR / RESPONSABLE : $authorName',
      'FECHA CERTIFICACION : $updatedAt',
      '--------------------------------------------------------------------------',
      'CONSTANCIA DE AUTENTICIDAD ANTE TERCEROS:',
      'Este certificado acredita que el documento referenciado se encuentra',
      'registrado y custodiado en el repositorio oficial de NexoDocs.',
      'Codigo QR de validacion: NEXODOCS|$code|${verificationHash.substring(0, 16)}',
    ];

    final bytes = buildOfficialPdfBytes(
      title: 'CERTIFICADO DE AUTENTICIDAD DOCUMENTAL',
      subtitle: 'Custodia y Verificacion Criptografica NexoDocs',
      lines: lines,
      verificationHash: verificationHash,
    );

    Directory dir;
    try {
      dir = await getTemporaryDirectory();
    } catch (_) {
      dir = Directory.systemTemp;
    }
    final safeCode = code.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final file = File('${dir.path}${Platform.pathSeparator}Certificado_$safeCode.pdf');
    file.writeAsBytesSync(bytes, flush: true);
    return file;
  }
}
