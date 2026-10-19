import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';

/// Abre el detalle de un documento (metadatos + versiones descargables).
Future<void> showDocumentDetail(BuildContext context, AuthApi api, String documentId) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
  builder: (_) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: 0.75,
    maxChildSize: 0.95,
    builder: (context, controller) => DocumentDetailSheet(api: api, documentId: documentId, scrollController: controller),
  ),
);

class DocumentDetailSheet extends StatefulWidget {
  const DocumentDetailSheet({super.key, required this.api, required this.documentId, this.scrollController});

  final AuthApi api;
  final String documentId;
  final ScrollController? scrollController;

  @override
  State<DocumentDetailSheet> createState() => _DocumentDetailSheetState();
}

class _DocumentDetailSheetState extends State<DocumentDetailSheet> {
  Map<String, dynamic>? document;
  List<Map<String, dynamic>> versions = [];
  String? error;
  bool loading = true;
  String? downloadingId;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        widget.api.documents.detail(widget.documentId),
        widget.api.documents.versions(widget.documentId),
      ]);
      if (!mounted) return;
      setState(() {
        document = results[0] as Map<String, dynamic>;
        versions = results[1] as List<Map<String, dynamic>>;
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> download(Map<String, dynamic> version) async {
    setState(() => downloadingId = version['id'] as String?);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final file = await widget.api.documents.downloadVersion(widget.documentId, version);
      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) {
        messenger.showSnackBar(SnackBar(content: Text('Archivo guardado en ${file.path}. No hay una app para abrirlo.')));
      }
    } on ApiException catch (exception) {
      messenger.showSnackBar(SnackBar(
        content: Text(exception.isNotFound ? 'El archivo de esta versión no está disponible en el servidor.' : exception.message),
        backgroundColor: Colors.red.shade700,
      ));
    } finally {
      if (mounted) setState(() => downloadingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    if (error != null) return ErrorStateView(message: error!, onRetry: load);
    final doc = document!;
    final status = doc['status'] as String?;
    return ListView(
      controller: widget.scrollController,
      padding: const EdgeInsets.all(24),
      children: [
        Center(
          child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppTheme.teal.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.description, color: AppTheme.teal, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(doc['name'] as String? ?? 'Documento', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              Text(doc['code'] as String? ?? '', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ]),
          ),
          StatusBadge(documentStatusLabel(status), tone: documentStatusTone(status)),
        ]),
        if ((doc['description'] as String?)?.isNotEmpty ?? false) ...[
          const SizedBox(height: 12),
          Text(doc['description'] as String, style: TextStyle(color: Colors.grey.shade700)),
        ],
        const Divider(height: 28),
        _row('Tipo documental', doc['documentTypeName']),
        _row('Categoría', doc['categoryName']),
        _row('Servicio / área', doc['departmentName']),
        _row('Autor', doc['authorName']),
        _row('Responsable', doc['responsibleName']),
        _row('Fecha de emisión', formatDate(doc['issueDate'])),
        _row('Fecha de vencimiento', formatDate(doc['expiryDate'])),
        _row('Última actualización', formatDate(doc['updatedAt'], withTime: true)),
        const SizedBox(height: 16),
        Text('Versiones (${versions.length})', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 6),
        if (versions.isEmpty) Text('Este documento aún no tiene archivos.', style: TextStyle(color: Colors.grey.shade600)),
        for (final version in versions)
          Card(
            elevation: 0,
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Colors.grey.shade200)),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppTheme.mint,
                child: Text('v${version['versionNumber']}', style: const TextStyle(fontSize: 12, color: AppTheme.teal, fontWeight: FontWeight.bold)),
              ),
              title: Text(version['fileName'] as String? ?? 'Archivo', maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('${formatBytes(version['fileSizeBytes'])} · ${formatDate(version['createdAt'], withTime: true)}'
                  '${(version['changeReason'] as String?)?.isNotEmpty ?? false ? '\n${version['changeReason']}' : ''}'),
              isThreeLine: (version['changeReason'] as String?)?.isNotEmpty ?? false,
              trailing: downloadingId == version['id']
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal))
                  : IconButton(
                      icon: const Icon(Icons.download, color: AppTheme.teal),
                      tooltip: 'Descargar',
                      onPressed: downloadingId == null ? () => download(version) : null,
                    ),
            ),
          ),
      ],
    );
  }

  Widget _row(String label, Object? value) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 140, child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13))),
      Expanded(child: Text(value?.toString() ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
    ]),
  );
}
