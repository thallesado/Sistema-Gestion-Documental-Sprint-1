import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:open_filex/open_filex.dart';
import '../../core/models/radicacion_receipt_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/pdf_generator.dart';
import '../../core/widgets/verification_qr_widget.dart';
import '../../core/i18n/app_language.dart';

/// Modal para visualizar, descargar en PDF y compartir el Comprobante Oficial de Radicación Digital con sello de tiempo y QR.
Future<void> showRadicacionReceiptSheet(BuildContext context, RadicacionReceiptModel receipt) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => RadicacionReceiptSheet(receipt: receipt),
  );
}

class RadicacionReceiptSheet extends StatefulWidget {
  const RadicacionReceiptSheet({super.key, required this.receipt});

  final RadicacionReceiptModel receipt;

  @override
  State<RadicacionReceiptSheet> createState() => _RadicacionReceiptSheetState();
}

class _RadicacionReceiptSheetState extends State<RadicacionReceiptSheet> {
  bool copied = false;
  bool generatingPdf = false;
  String? savedPdfPath;

  Future<void> copyCertificate() async {
    try {
      final text = widget.receipt.toFormalCertificateText();
      await Clipboard.setData(ClipboardData(text: text));
    } catch (_) {
      // Silenciar excepción de portapapeles si la plataforma no lo soporta
    }
    if (mounted) {
      setState(() => copied = true);
    }
  }

  Future<void> downloadPdf() async {
    setState(() => generatingPdf = true);
    try {
      final file = await PdfGenerator.saveRadicacionReceiptPdf(widget.receipt);
      if (!mounted) return;
      setState(() {
        savedPdfPath = file.path;
        generatingPdf = false;
      });
      unawaited(
        OpenFilex.open(file.path).then<void>((_) {}, onError: (_) {}),
      );
    } catch (_) {
      if (mounted) {
        setState(() => generatingPdf = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = widget.receipt;
    final dateStr = receipt.timestamp.toLocal().toString().split('.').first;

    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle superior
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),

            // Encabezado limpio
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: [
                  const Icon(Icons.verified_outlined, color: AppTheme.teal, size: 26),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      context.tr('Comprobante de Radicación'),
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.ink),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Contenido con diseño de papel membretado digital organizado
            Expanded(
              child: ListView(
                key: const Key('radicacion-receipt-scroll'),
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.grey.shade300, width: 1.2),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Encabezado institucional
                        Center(
                          child: Column(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: const BoxDecoration(
                                  color: AppTheme.mint,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.account_balance, color: AppTheme.teal, size: 28),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                receipt.tenantName.toUpperCase(),
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.ink),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                context.tr('VENTANILLA ÚNICA DE RADICACIÓN DIGITAL'),
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Colors.grey, letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Divider(thickness: 1),
                        const SizedBox(height: 12),

                        // Código y Sello de Tiempo
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppTheme.teal.withValues(alpha: 0.3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.tr('NÚMERO DE RADICACIÓN OFICIAL'),
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: AppTheme.teal),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                receipt.code,
                                style: const TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.1,
                                  color: AppTheme.ink,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.access_time, size: 14, color: Colors.grey),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'Estampado cronológico: $dateStr',
                                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Datos del trámite
                        _sectionTitle(context.tr('INFORMACIÓN DE LA SOLICITUD')),
                        _infoRow(context.tr('Tipo de Trámite'), receipt.radicacionType),
                        _infoRow(context.tr('Asunto'), receipt.subject),
                        _infoRow(context.tr('Término Legal'), '${receipt.legalResponseDays} días hábiles'),
                        if (receipt.attachmentName != null)
                          _infoRow(context.tr('Soporte Digital'), receipt.attachmentName!),
                        if (receipt.signatureHash != null && receipt.signatureHash!.isNotEmpty)
                          _infoRow(context.tr('Firma Ciudadana'), 'Firmado digitalmente (${receipt.signatureHash!.substring(0, 12)}...)'),
                        const SizedBox(height: 14),

                        // Datos del solicitante
                        _sectionTitle(context.tr('DATOS DEL SOLICITANTE')),
                        _infoRow(context.tr('Nombre'), receipt.citizenName),
                        _infoRow(context.tr('Identificación'), '${receipt.citizenDocumentType} ${receipt.citizenDocumentNumber}'),
                        _infoRow(context.tr('Correo Electrónico'), receipt.citizenEmail),
                        const SizedBox(height: 16),

                        // Código QR de Verificación y Sello SHA-256
                        _sectionTitle(context.tr('VERIFICACIÓN QR Y SELLO CRIPTOGRÁFICO (SHA-256)')),
                        const SizedBox(height: 6),
                        Center(
                          child: VerificationQrWidget(
                            code: receipt.code,
                            verificationHash: receipt.verificationHash,
                            tenantName: receipt.tenantName,
                            size: 118,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: SelectableText(
                            receipt.verificationHash,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          context.tr('Este comprobante digital cuenta con plena validez jurídica, código QR de verificación e integridad probatoria.'),
                          style: TextStyle(fontSize: 10.5, color: Colors.grey, height: 1.3),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Botones de acción organizados y ergonómicos en la parte inferior
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, -2)),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (savedPdfPath != null)
                    Container(
                      key: const Key('pdf-saved-indicator'),
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.mint.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.teal.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.picture_as_pdf, size: 18, color: AppTheme.teal),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              tr('PDF Oficial guardado: {name}', {'name': savedPdfPath!.split(RegExp(r'[/\\]')).last}),
                              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppTheme.tealDark),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          key: const Key('download-receipt-pdf-button'),
                          onPressed: generatingPdf ? null : downloadPdf,
                          icon: Icon(savedPdfPath != null ? Icons.download_done : Icons.picture_as_pdf_outlined, size: 18),
                          label: Text(
                            savedPdfPath != null ? context.tr('PDF Guardado') : context.tr('Descargar PDF'),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppTheme.teal,
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          key: const Key('copy-certificate-button'),
                          onPressed: copyCertificate,
                          icon: Icon(copied ? Icons.check : Icons.copy, size: 18),
                          label: Text(
                            copied ? context.tr('Comprobante Copiado') : context.tr('Copiar Comprobante Oficial'),
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.teal,
                            side: const BorderSide(color: AppTheme.teal),
                            padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    key: const Key('close-receipt-button'),
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: Text(context.tr('Entendido')),
                    style: TextButton.styleFrom(
                      foregroundColor: AppTheme.ink,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        title,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 0.5),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppTheme.ink),
            ),
          ),
        ],
      ),
    );
  }
}
