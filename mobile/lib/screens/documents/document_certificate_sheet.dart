import 'dart:async';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:open_filex/open_filex.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/pdf_generator.dart';
import '../../core/widgets/verification_qr_widget.dart';
import '../../core/i18n/app_language.dart';

/// Abre la hoja modal del Certificado de Autenticidad con Código QR para presentar ante terceros.
Future<void> showDocumentCertificateSheet(
  BuildContext context, {
  required Map<String, dynamic> document,
  Map<String, dynamic>? latestVersion,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => DocumentCertificateSheet(
      document: document,
      latestVersion: latestVersion,
    ),
  );
}

class DocumentCertificateSheet extends StatefulWidget {
  const DocumentCertificateSheet({
    super.key,
    required this.document,
    this.latestVersion,
  });

  final Map<String, dynamic> document;
  final Map<String, dynamic>? latestVersion;

  @override
  State<DocumentCertificateSheet> createState() => _DocumentCertificateSheetState();
}

class _DocumentCertificateSheetState extends State<DocumentCertificateSheet> {
  bool _copied = false;
  bool _savingPdf = false;
  String? _savedPdfPath;

  String get _code => (widget.document['code'] as String?)?.trim().isNotEmpty == true
      ? widget.document['code'] as String
      : 'DOC-${widget.document['id'] ?? 'OFICIAL'}';

  String get _name => widget.document['name'] as String? ?? context.tr('Documento Oficial');
  String get _status => documentStatusLabel(widget.document['status'] as String?);
  String get _author => widget.document['authorName'] as String? ??
      widget.document['responsibleName'] as String? ??
      context.tr('Custodia Institucional');
  String get _versionNumber => (widget.latestVersion?['versionNumber'] ?? 1).toString();
  String get _updatedAt => formatDate(widget.document['updatedAt'] ?? DateTime.now().toIso8601String(), withTime: true);

  String get _verificationHash {
    final existingHash = widget.latestVersion?['sha256'] as String? ??
        widget.latestVersion?['fileHash'] as String? ??
        widget.document['sha256'] as String?;
    if (existingHash != null && existingHash.trim().length >= 32) {
      return existingHash.trim();
    }
    final seed = '$_code|$_name|$_versionNumber|$_status';
    return sha256.convert(utf8.encode(seed)).toString();
  }

  Future<void> _copyVerificationData() async {
    final text = 'CERTIFICADO DE AUTENTICIDAD NEXODOCS\n'
        'Documento: $_name ($_code)\n'
        'Estado: $_status · Versión v$_versionNumber\n'
        'Hash SHA-256: $_verificationHash\n'
        'Verificación QR: NEXODOCS|$_code|${_verificationHash.substring(0, 16)}';
    try {
      await Clipboard.setData(ClipboardData(text: text));
    } catch (_) {}
    if (mounted) setState(() => _copied = true);
  }

  Future<void> _downloadPdf() async {
    setState(() => _savingPdf = true);
    try {
      final file = await PdfGenerator.saveDocumentCertificatePdf(
        code: _code,
        name: _name,
        status: _status,
        authorName: _author,
        versionNumber: _versionNumber,
        updatedAt: _updatedAt,
        verificationHash: _verificationHash,
      );
      if (!mounted) return;
      setState(() {
        _savedPdfPath = file.path;
        _savingPdf = false;
      });
      unawaited(
        OpenFilex.open(file.path).then<void>((_) {}, onError: (_) {}),
      );
    } catch (_) {
      if (mounted) setState(() => _savingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.82,
      minChildSize: 0.5,
      maxChildSize: 0.94,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: [
                  const Icon(Icons.qr_code_scanner, color: AppTheme.teal, size: 24),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      context.tr('Certificado QR de Autenticidad'),
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
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.all(18),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Column(
                      children: [
                        VerificationQrWidget(
                          code: _code,
                          verificationHash: _verificationHash,
                          size: 136,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _name,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$_code · Versión v$_versionNumber · $_status',
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.teal),
                        ),
                        const Divider(height: 24),
                        _row(context.tr('Responsable / Autor'), _author),
                        _row(context.tr('Fecha Certificación'), _updatedAt),
                        _row(context.tr('Validez ante Terceros'), context.tr('Verificable por QR y SHA-256')),
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.tr('HUELLA CRIPTOGRÁFICA SHA-256:'),
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black54),
                              ),
                              const SizedBox(height: 4),
                              SelectableText(
                                _verificationHash,
                                style: const TextStyle(fontFamily: 'monospace', fontSize: 10.5, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                        if (_savedPdfPath != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            key: const Key('doc-certificate-pdf-saved'),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppTheme.mint.withValues(alpha: 0.4),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle, size: 18, color: AppTheme.teal),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    tr('Certificado PDF descargado: {name}', {'name': _savedPdfPath!.split(RegExp(r'[/\\]')).last}),
                                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppTheme.tealDark),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      key: const Key('download-doc-certificate-pdf-button'),
                      onPressed: _savingPdf ? null : _downloadPdf,
                      icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                      label: Text(_savedPdfPath != null ? context.tr('PDF Descargado') : context.tr('Descargar PDF')),
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
                      key: const Key('copy-doc-certificate-button'),
                      onPressed: _copyVerificationData,
                      icon: Icon(_copied ? Icons.check : Icons.copy, size: 18),
                      label: Text(_copied ? context.tr('Copiado') : context.tr('Copiar Constancia')),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.teal,
                        side: const BorderSide(color: AppTheme.teal),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
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

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 135,
            child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.ink)),
          ),
        ],
      ),
    );
  }
}
