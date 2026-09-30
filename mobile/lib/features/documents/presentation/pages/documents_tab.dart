import 'package:flutter/material.dart';
import '../../../../core/api/auth_api.dart';
import '../widgets/document_filter_chips.dart';
import '../widgets/document_item_tile.dart';

class DocumentsTab extends StatefulWidget {
  const DocumentsTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<DocumentsTab> {
  List<Map<String, dynamic>> documents = [];
  bool loading = true;
  String? error;
  String selectedFilter = '';
  String searchQuery = '';

  @override
  void initState() {
    super.initState();
    loadDocuments();
  }

  Future<void> loadDocuments() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final res = await widget.api.documents(
        filter: searchQuery,
        status: selectedFilter.isNotEmpty && selectedFilter != 'mine' ? selectedFilter : null,
        scope: selectedFilter == 'mine' ? 'mine' : null,
      );
      if (mounted) setState(() => documents = res);
    } catch (e) {
      if (mounted) setState(() => error = 'Error al cargar documentos');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Buscar documentos por nombre o código…',
              prefixIcon: const Icon(Icons.search, size: 20),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xffe5e7eb)),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
            ),
            onChanged: (val) {
              searchQuery = val;
              loadDocuments();
            },
          ),
        ),
        DocumentFilterChips(
          selectedFilter: selectedFilter,
          onFilterChanged: (filter) {
            setState(() => selectedFilter = filter);
            loadDocuments();
          },
        ),
        const SizedBox(height: 8),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xff087f7b)))
              : RefreshIndicator(
                  onRefresh: loadDocuments,
                  color: const Color(0xff087f7b),
                  child: documents.isEmpty
                      ? const Center(child: Text('No se encontraron documentos', style: TextStyle(color: Color(0xff6b7280))))
                      : ListView.builder(
                          itemCount: documents.length,
                          itemBuilder: (ctx, i) => DocumentItemTile(doc: documents[i]),
                        ),
                ),
        ),
      ],
    );
  }
}
