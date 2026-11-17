import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../../features/documents/presentation/widgets/document_filter_chips.dart';
import '../../features/documents/presentation/widgets/document_item_tile.dart';
import '../scan/scan_document_page.dart';
import 'create_document_page.dart';
import 'document_detail_sheet.dart';
import '../../core/i18n/app_language.dart';

class DocumentsTab extends StatefulWidget {
  const DocumentsTab({super.key, required this.api, this.onOpenFile});

  final AuthApi api;
  final Future<void> Function(String filePath)? onOpenFile;

  @override
  State<DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<DocumentsTab> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> documents = [];
  bool loading = false;
  String? error;
  String? downloadingDocId;

  /// null = todos. Los códigos son los que entiende la API; la etiqueta, la de la web.
  String? selectedStatus;
  static const statuses = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'CURRENT', 'REJECTED', 'ARCHIVED'];

  @override
  void initState() {
    super.initState();
    loadDocuments();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> loadDocuments() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final docs = await widget.api.documents.list(search: searchController.text.trim(), status: selectedStatus);
      if (mounted) setState(() => documents = docs);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> downloadDocument(Map<String, dynamic> doc) async {
    final docId = doc['id'] as String;
    setState(() => downloadingDocId = docId);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final versions = await widget.api.documents.versions(docId);
      if (versions.isEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(tr('Este documento aún no tiene archivos registrados.'))));
        return;
      }
      final latest = versions.first;
      final file = await widget.api.documents.downloadVersion(docId, latest);
      if (widget.onOpenFile != null) {
        await widget.onOpenFile!(file.path);
      } else {
        final result = await OpenFilex.open(file.path);
        if (result.type != ResultType.done) {
          messenger.showSnackBar(SnackBar(
            content: Text(tr('Archivo guardado: {name}', {'name': latest['fileName'] ?? file.path.split(RegExp(r'[/\\]')).last})),
          ));
        }
      }
    } on ApiException catch (exception) {
      messenger.showSnackBar(SnackBar(
        content: Text(exception.isNotFound ? tr('El archivo de este documento no está disponible en el servidor.') : exception.message),
        backgroundColor: Colors.red.shade700,
      ));
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(tr('Error al descargar: {error}', {'error': e})),
        backgroundColor: Colors.red.shade700,
      ));
    } finally {
      if (mounted) setState(() => downloadingDocId = null);
    }
  }

  Future<void> createDocument() async {
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => CreateDocumentPage(api: widget.api)),
    );
    if (created == null || !mounted) return;
    await loadDocuments();
    if (mounted) showDocumentDetail(context, widget.api, created['id'] as String);
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          SearchBar(
            controller: searchController,
            hintText: context.tr('Buscar por código o nombre...'),
            leading: const Icon(Icons.search, color: AppTheme.teal, size: 20),
            trailing: [
              if (searchController.text.isNotEmpty)
                IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () {
                    searchController.clear();
                    loadDocuments();
                  },
                ),
              if (widget.api.permissions.value.can(Permissions.documentCreate))
                IconButton(
                  key: const Key('documents-create'),
                  tooltip: context.tr('Nuevo documento'),
                  icon: const Icon(Icons.note_add_outlined, color: AppTheme.teal, size: 20),
                  onPressed: createDocument,
                ),
              IconButton(
                key: const Key('documents-scan-button'),
                tooltip: context.tr('Escanear con cámara'),
                icon: const Icon(Icons.document_scanner, color: AppTheme.teal, size: 20),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => ScanDocumentPage(api: widget.api)),
                ).then((_) => loadDocuments()),
              ),
            ],
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => loadDocuments(),
            elevation: const WidgetStatePropertyAll(0),
            backgroundColor: WidgetStatePropertyAll(Colors.grey.shade100),
            shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          ),
          const SizedBox(height: 10),
          DocumentFilterChips(
            statuses: statuses,
            selected: selectedStatus,
            allLabel: context.tr('Todos'),
            labelFor: documentStatusLabel,
            onChanged: (value) {
              setState(() => selectedStatus = value);
              loadDocuments();
            },
          ),
        ]),
      ),
      if (loading) const LinearProgressIndicator(color: AppTheme.teal),
      Expanded(
        child: RefreshIndicator(
          onRefresh: loadDocuments,
          color: AppTheme.teal,
          child: error != null
              ? ErrorStateView(message: error!, onRetry: loadDocuments)
              : documents.isEmpty && !loading
              ? EmptyStateView(message: tr('No se encontraron documentos.'), icon: Icons.description_outlined)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: documents.length,
                  itemBuilder: (context, index) {
                    final doc = documents[index];
                    return DocumentItemTile(
                      doc: doc,
                      onTap: () => showDocumentDetail(context, widget.api, doc['id'] as String),
                      downloading: downloadingDocId == doc['id'],
                      onDownload: downloadingDocId == null ? () => downloadDocument(doc) : null,
                    );
                  },
                ),
        ),
      ),
    ],
  );
}
