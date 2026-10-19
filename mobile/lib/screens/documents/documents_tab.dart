import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import 'document_detail_sheet.dart';

class DocumentsTab extends StatefulWidget {
  const DocumentsTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<DocumentsTab> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> documents = [];
  bool loading = false;
  String? error;

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
          SearchBar(
            controller: searchController,
            hintText: 'Buscar por código o nombre...',
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
            ],
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => loadDocuments(),
            elevation: const WidgetStatePropertyAll(0),
            backgroundColor: WidgetStatePropertyAll(Colors.grey.shade100),
            shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _chip('Todos', null),
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
              ? const EmptyStateView(message: 'No se encontraron documentos.', icon: Icons.description_outlined)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: documents.length,
                  itemBuilder: (context, index) {
                    final doc = documents[index];
                    final status = doc['status'] as String?;
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
                          doc['name'] as String? ?? 'Documento',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        subtitle: Text(
                          [doc['code'], doc['documentTypeName'], 'v${doc['currentVersion'] ?? 1}'].whereType<Object>().join(' · '),
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        trailing: StatusBadge(documentStatusLabel(status), tone: documentStatusTone(status)),
                        onTap: () => showDocumentDetail(context, widget.api, doc['id'] as String),
                      ),
                    );
                  },
                ),
        ),
      ),
    ],
  );
}
