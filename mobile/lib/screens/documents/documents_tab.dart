import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/document_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
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
  List<DocumentModel> documents = [];
  bool loading = false;
  String? error;
  String? downloadingDocId;

  /// Ámbito de vista: false = repositorio general (administrativo), true = mis documentos (usuario final).
  bool onlyMine = false;

  /// null = todos. Los códigos son los que entiende la API; la etiqueta, la de la web.
  String? selectedStatus;
  static const statuses = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'CURRENT', 'REJECTED', 'ARCHIVED'];

  bool get canCreate => widget.api.permissions.value.can(Permissions.documentCreate);

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
      final docs = onlyMine
          ? await widget.api.documents.getMyDocuments(search: searchController.text.trim(), status: selectedStatus)
          : await widget.api.documents.getDocuments(search: searchController.text.trim(), status: selectedStatus);
      if (mounted) setState(() => documents = docs);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
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

  Future<void> downloadDocument(DocumentModel doc) async {
    final docId = doc.id;
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

  Widget _chip(String label, String? value) {
    final selected = selectedStatus == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) {
          setState(() => selectedStatus = value);
          loadDocuments();
        },
        selectedColor: AppTheme.mint,
        checkmarkColor: AppTheme.teal,
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.bold : FontWeight.normal,
          color: selected ? AppTheme.teal : const Color(0xff374151),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          Row(
            children: [
              Expanded(
                child: SearchBar(
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
              ),
              if (canCreate) ...[
                const SizedBox(width: 8),
                IconButton.filled(
                  key: const Key('create-doc-button'),
                  tooltip: context.tr('Nuevo documento / trámite'),
                  style: IconButton.styleFrom(backgroundColor: AppTheme.teal),
                  icon: const Icon(Icons.add, color: Colors.white),
                  onPressed: createDocument,
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          // Selector de ámbito (Todos los documentos vs Mis trámites para usuario final)
          Row(
            children: [
              ChoiceChip(
                label: Text(context.tr('Todos')),
                selected: !onlyMine,
                onSelected: (val) {
                  if (val) {
                    setState(() => onlyMine = false);
                    loadDocuments();
                  }
                },
                selectedColor: AppTheme.mint,
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: !onlyMine ? FontWeight.bold : FontWeight.normal,
                  color: !onlyMine ? AppTheme.teal : Colors.grey.shade700,
                ),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: Text(context.tr('Mis documentos / trámites')),
                selected: onlyMine,
                onSelected: (val) {
                  if (val) {
                    setState(() => onlyMine = true);
                    loadDocuments();
                  }
                },
                selectedColor: AppTheme.mint,
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: onlyMine ? FontWeight.bold : FontWeight.normal,
                  color: onlyMine ? AppTheme.teal : Colors.grey.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _chip(context.tr('Todos'), null),
              for (final status in statuses) _chip(documentStatusLabel(status), status),
            ]),
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
              ? EmptyStateView(message: context.tr('No se encontraron documentos.'), icon: Icons.description_outlined)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: documents.length,
                  itemBuilder: (context, index) {
                    final doc = documents[index];
                    final status = doc.status;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        leading: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: AppTheme.teal.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.description_outlined, color: AppTheme.teal),
                        ),
                        title: Text(
                          doc.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        subtitle: Text(
                          [doc.code, doc.documentTypeName, 'v${doc.currentVersion}'].where((e) => e != null && e.toString().isNotEmpty).join(' · '),
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            StatusBadge(documentStatusLabel(status), tone: documentStatusTone(status)),
                            const SizedBox(width: 4),
                            downloadingDocId == doc.id
                                ? const Padding(
                                    padding: EdgeInsets.all(8),
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal),
                                    ),
                                  )
                                : IconButton(
                                    key: Key('download-doc-${doc.id}'),
                                    icon: const Icon(Icons.download_outlined, color: AppTheme.teal, size: 22),
                                    tooltip: context.tr('Descargar archivo'),
                                    onPressed: downloadingDocId == null ? () => downloadDocument(doc) : null,
                                  ),
                          ],
                        ),
                        onTap: () => showDocumentDetail(context, widget.api, doc.id),
                      ),
                    );
                  },
                ),
        ),
      ),
    ],
  );
}
