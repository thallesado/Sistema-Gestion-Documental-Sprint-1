import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';

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
  String selectedStatus = 'Todos';

  final statuses = ['Todos', 'Aprobado', 'En revisión', 'Pendiente'];

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
      final docs = await widget.api.documents(
        search: searchController.text.trim(),
        status: selectedStatus == 'Todos' ? null : selectedStatus,
      );
      if (mounted) setState(() => documents = docs);
    } catch (e) {
      if (mounted) setState(() => error = 'No se pudieron cargar los documentos.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void openDocumentDetail(Map<String, dynamic> doc) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xff087f7b).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.description, color: Color(0xff087f7b), size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doc['name'] as String? ?? 'Documento',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        doc['code'] as String? ?? 'DOC',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 28),
            _buildDetailRow('Estado', doc['status'] as String? ?? 'Activo'),
            if (doc['author'] != null) _buildDetailRow('Responsable', doc['author'] as String),
            if (doc['type'] != null) _buildDetailRow('Formato', doc['type'] as String),
            if (doc['updatedAt'] != null) _buildDetailRow('Última actualización', doc['updatedAt'] as String),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Descarga de documento preparada')),
                  );
                },
                icon: const Icon(Icons.download, size: 18),
                label: const Text('Descargar archivo'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xff087f7b),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search & Filter header
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(
            children: [
              SearchBar(
                controller: searchController,
                hintText: 'Buscar por código o nombre...',
                leading: const Icon(Icons.search, color: Color(0xff087f7b), size: 20),
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
                onSubmitted: (_) => loadDocuments(),
                elevation: const WidgetStatePropertyAll(0),
                backgroundColor: WidgetStatePropertyAll(Colors.grey.shade100),
                shape: WidgetStatePropertyAll(
                  RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: statuses.map((status) {
                    final selected = selectedStatus == status;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(status),
                        selected: selected,
                        onSelected: (_) {
                          setState(() => selectedStatus = status);
                          loadDocuments();
                        },
                        selectedColor: const Color(0xffd4ece7),
                        checkmarkColor: const Color(0xff087f7b),
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                          color: selected ? const Color(0xff087f7b) : const Color(0xff374151),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),

        if (loading) const LinearProgressIndicator(color: Color(0xff087f7b)),

        Expanded(
          child: RefreshIndicator(
            onRefresh: loadDocuments,
            color: const Color(0xff087f7b),
            child: documents.isEmpty && !loading
                ? Center(
                    child: Text(
                      'No se encontraron documentos.',
                      style: TextStyle(color: Colors.grey.shade500),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: documents.length,
                    itemBuilder: (context, index) {
                      final doc = documents[index];
                      final name = doc['name'] as String? ?? 'Documento';
                      final code = doc['code'] as String? ?? 'DOC';
                      final status = doc['status'] as String? ?? 'Aprobado';
                      final type = doc['type'] as String? ?? 'DOC';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          leading: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xff087f7b).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Center(
                              child: Text(
                                type,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                  color: Color(0xff087f7b),
                                ),
                              ),
                            ),
                          ),
                          title: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          subtitle: Text(
                            code,
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: status == 'Aprobado'
                                  ? const Color(0xffd1fae5)
                                  : const Color(0xfffef3c7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              status,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: status == 'Aprobado'
                                    ? const Color(0xff065f46)
                                    : const Color(0xff92400e),
                              ),
                            ),
                          ),
                          onTap: () => openDocumentDetail(doc),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
