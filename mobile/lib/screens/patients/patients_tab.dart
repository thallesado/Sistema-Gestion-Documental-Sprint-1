import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/patient_model.dart';
import 'patient_appointments_sheet.dart';
import 'patient_clinical_history_sheet.dart';
import 'widgets/summary_card.dart';
import '../../core/i18n/app_language.dart';

class PatientsTab extends StatefulWidget {
  const PatientsTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<PatientsTab> createState() => _PatientsTabState();
}

class _PatientsTabState extends State<PatientsTab> {
  final searchController = TextEditingController();
  List<PatientModel> patients = [];
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
      final result = await widget.api.clinical.getPatients(searchController.text.trim());
      if (mounted) setState(() => patients = result);
    } catch (exception) {
      if (mounted) {
        setState(
          () => error = exception is ApiException
              ? exception.message
              : context.tr('No se pudo buscar pacientes.'),
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
      final result = await widget.api.clinical.quickSummary(id);
      if (mounted) setState(() => summary = result);
    } catch (exception) {
      if (mounted) {
        setState(
          () => error = exception is ApiException
              ? exception.message
              : context.tr('No se pudo abrir el resumen clínico.'),
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
            hintText: context.tr('Buscar por CI, seguro o nombre...'),
            leading: const Icon(Icons.search, color: Color(0xff087f7b), size: 20),
            trailing: [
              IconButton(
                onPressed: loading ? null : search,
                icon: const Icon(Icons.arrow_forward),
                tooltip: context.tr('Buscar'),
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
            padding: const EdgeInsets.all(16),
            child: Text(
              error!,
              style: const TextStyle(color: Color(0xffb73838)),
            ),
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (summary != null) SummaryCard(summary: summary!),
              if (patients.isEmpty && !loading)
                Center(
                  child: Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: Text(context.tr('No se encontraron pacientes.')),
                  ),
                ),
              ...patients.map((patient) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xffc5efe4),
                      child: Icon(Icons.person, color: Color(0xff087f7b)),
                    ),
                    title: Text(patient.fullName),
                    subtitle: Text(
                      'CI: ${patient.documentNumber.isNotEmpty ? patient.documentNumber : '—'} · Sangre: ${patient.bloodGroup ?? '—'}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          key: Key('patient-appointments-${patient.id}'),
                          icon: const Icon(Icons.calendar_month_outlined, color: Color(0xff087f7b)),
                          tooltip: context.tr('Citas médicas y agendamiento'),
                          onPressed: () => showPatientAppointmentsSheet(context, widget.api.clinical, patient),
                        ),
                        IconButton(
                          key: Key('patient-history-${patient.id}'),
                          icon: const Icon(Icons.medical_information_outlined, color: Color(0xff087f7b)),
                          tooltip: context.tr('Historial clínico completo'),
                          onPressed: () => showPatientClinicalHistorySheet(context, widget.api.clinical, patient, auth: widget.api),
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                    onTap: () => openSummary(patient.id),
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }
}
