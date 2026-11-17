import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_views.dart';
import 'clinical_labels.dart';
import 'create_patient_sheet.dart';
import 'patient_detail_page.dart';

/// Búsqueda de pacientes; cada uno abre su ficha clínica completa.
class PatientsTab extends StatefulWidget {
  const PatientsTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<PatientsTab> createState() => _PatientsTabState();
}

class _PatientsTabState extends State<PatientsTab> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> patients = [];
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
    });
    try {
      final result = await widget.api.clinical.patients(searchController.text.trim());
      if (mounted) setState(() => patients = result);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> open(Map<String, dynamic> patient) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => PatientDetailPage(api: widget.api, patientId: patient['id'] as String, patient: patient)),
    );
  }

  Future<void> create() async {
    final created = await showCreatePatientSheet(context, widget.api);
    if (created == null || !mounted) return;
    await search();
    if (mounted) open(created);
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.all(16),
        child: SearchBar(
          key: const Key('patients-search'),
          controller: searchController,
          hintText: context.tr('Buscar por CI, seguro o nombre...'),
          leading: const Icon(Icons.search, color: AppTheme.teal, size: 20),
          trailing: [
            IconButton(onPressed: loading ? null : search, icon: const Icon(Icons.arrow_forward), tooltip: context.tr('Buscar')),
            if (widget.api.permissions.value.can(Permissions.patientCreate))
              IconButton(
                key: const Key('patient-create'),
                onPressed: create,
                icon: const Icon(Icons.person_add_alt_1_outlined, color: AppTheme.teal),
                tooltip: context.tr('Nuevo paciente'),
              ),
          ],
          onSubmitted: (_) => search(),
          elevation: const WidgetStatePropertyAll(0),
          backgroundColor: WidgetStatePropertyAll(Colors.grey.shade100),
          shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        ),
      ),
      if (loading) const LinearProgressIndicator(color: AppTheme.teal),
      Expanded(
        child: RefreshIndicator(
          onRefresh: search,
          color: AppTheme.teal,
          child: error != null
              ? ErrorStateView(message: error!, onRetry: search)
              : patients.isEmpty && !loading
              ? EmptyStateView(message: context.tr('No se encontraron pacientes.'), icon: Icons.person_search_outlined)
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: patients.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final patient = patients[index];
                    final name = '${patient['firstName'] ?? ''} ${patient['lastName'] ?? ''}'.trim();
                    final status = patient['status'] as String?;
                    return Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                      child: ListTile(
                        key: Key('patient-${patient['id']}'),
                        leading: CircleAvatar(
                          backgroundColor: AppTheme.teal.withValues(alpha: 0.1),
                          child: const Icon(Icons.person, color: AppTheme.teal),
                        ),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(
                          '${patient['documentType'] ?? 'CI'}: ${patient['documentNumber'] ?? ''}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (status != null && status != 'ACTIVE') StatusBadge(patientStatusLabel(status)),
                            const Icon(Icons.chevron_right, size: 20),
                          ],
                        ),
                        onTap: patient['id'] is String ? () => open(patient) : null,
                      ),
                    );
                  },
                ),
        ),
      ),
    ],
  );
}
