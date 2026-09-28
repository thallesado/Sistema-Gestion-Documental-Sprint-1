import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../../core/errors/auth_exception.dart';
import 'widgets/summary_card.dart';

class PatientsTab extends StatefulWidget {
  const PatientsTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<PatientsTab> createState() => _PatientsTabState();
}

class _PatientsTabState extends State<PatientsTab> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> patients = [];
  Map<String, dynamic>? summary;
  bool loading = false;
  String? error;

  @override
  void initState() {
    super.initState();
    search();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> search() async {
    setState(() {
      loading = true;
      error = null;
      summary = null;
    });
    try {
      final result = await widget.api.patients(searchController.text.trim());
      if (mounted) setState(() => patients = result);
    } catch (exception) {
      if (mounted) {
        setState(
          () => error = exception is AuthException
              ? exception.message
              : 'No se pudo buscar pacientes.',
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openSummary(String id) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.quickSummary(id);
      if (mounted) setState(() => summary = result);
    } catch (exception) {
      if (mounted) {
        setState(
          () => error = exception is AuthException
              ? exception.message
              : 'No se pudo abrir el resumen clínico.',
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.all(16),
          child: SearchBar(
            controller: searchController,
            hintText: 'Buscar por CI, seguro o nombre...',
            leading: const Icon(Icons.search, color: Color(0xff087f7b), size: 20),
            trailing: [
              IconButton(
                onPressed: loading ? null : search,
                icon: const Icon(Icons.arrow_forward),
                tooltip: 'Buscar',
              ),
            ],
            onSubmitted: (_) => search(),
            elevation: const WidgetStatePropertyAll(0),
            backgroundColor: WidgetStatePropertyAll(Colors.grey.shade100),
            shape: WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        if (loading) const LinearProgressIndicator(color: Color(0xff087f7b)),
        if (error != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        Expanded(
          child: summary != null
              ? SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextButton.icon(
                        onPressed: () => setState(() => summary = null),
                        icon: const Icon(Icons.arrow_back, size: 18),
                        label: const Text('Volver al listado'),
                      ),
                      const SizedBox(height: 8),
                      SummaryCard(summary: summary!),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: search,
                  color: const Color(0xff087f7b),
                  child: patients.isEmpty && !loading
                      ? Center(
                          child: Text(
                            'No se encontraron pacientes.',
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: patients.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final patient = patients[index];
                            final firstName = patient['firstName'] as String? ?? '';
                            final lastName = patient['lastName'] as String? ?? '';
                            final docType = patient['documentType'] as String? ?? 'CI';
                            final docNumber = patient['documentNumber'] as String? ?? '';
                            final id = patient['id'] as String? ?? '$index';

                            return Card(
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(color: Colors.grey.shade200),
                              ),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: const Color(0xff087f7b).withValues(alpha: 0.1),
                                  child: const Icon(Icons.person, color: Color(0xff087f7b)),
                                ),
                                title: Text(
                                  '$firstName $lastName',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                ),
                                subtitle: Text(
                                  '$docType: $docNumber',
                                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                ),
                                trailing: const Icon(Icons.chevron_right, size: 20),
                                onTap: () => openSummary(id),
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
