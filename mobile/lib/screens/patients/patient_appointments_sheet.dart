import 'package:flutter/material.dart';
import '../../core/api/clinical_api.dart';
import '../../core/models/medical_appointment_model.dart';
import '../../core/models/patient_model.dart';
import '../../core/theme/app_theme.dart';

/// Abre la hoja de gestión y agendamiento de Citas Médicas para un paciente del sector salud.
Future<void> showPatientAppointmentsSheet(
  BuildContext context,
  ClinicalApi clinicalApi,
  PatientModel patient,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => PatientAppointmentsSheet(
      clinicalApi: clinicalApi,
      patient: patient,
    ),
  );
}

class PatientAppointmentsSheet extends StatefulWidget {
  const PatientAppointmentsSheet({
    super.key,
    required this.clinicalApi,
    required this.patient,
  });

  final ClinicalApi clinicalApi;
  final PatientModel patient;

  @override
  State<PatientAppointmentsSheet> createState() => _PatientAppointmentsSheetState();
}

class _PatientAppointmentsSheetState extends State<PatientAppointmentsSheet>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  List<MedicalAppointmentModel> _appointments = [];
  bool _loading = true;
  bool _submitting = false;

  static const _specialties = <String>[
    'Medicina General',
    'Odontología',
    'Pediatría',
    'Cardiología',
    'Laboratorio Clínico',
  ];

  static const _timeSlots = <String>[
    'Mañana (08:00 - 12:00)',
    'Tarde (14:00 - 18:00)',
  ];

  String _selectedSpecialty = _specialties.first;
  String _selectedTimeSlot = _timeSlots.first;
  final TextEditingController _dateController = TextEditingController(
    text: DateTime.now().add(const Duration(days: 3)).toIso8601String().split('T').first,
  );
  final TextEditingController _reasonController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAppointments();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _dateController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadAppointments() async {
    setState(() => _loading = true);
    try {
      final list = await widget.clinicalApi.getAppointments(
        widget.patient.id,
        patientName: widget.patient.fullName,
      );
      if (mounted) {
        setState(() {
          _appointments = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitAppointment() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final created = await widget.clinicalApi.scheduleAppointment(
        patientId: widget.patient.id,
        patientName: widget.patient.fullName,
        specialty: _selectedSpecialty,
        preferredDate: _dateController.text.trim(),
        timeSlot: _selectedTimeSlot,
        reason: _reasonController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _appointments = [created, ..._appointments];
        _submitting = false;
        _reasonController.clear();
        _tabController.animateTo(0);
      });
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
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
                  CircleAvatar(
                    backgroundColor: AppTheme.mint,
                    child: const Icon(Icons.calendar_month, color: AppTheme.teal, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Citas Médicas y Agendamiento',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
                        ),
                        Text(
                          'Paciente: ${widget.patient.fullName}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                ],
              ),
            ),
            TabBar(
              controller: _tabController,
              indicatorColor: AppTheme.teal,
              labelColor: AppTheme.tealDark,
              tabs: const [
                Tab(icon: Icon(Icons.event_available_outlined, size: 18), text: 'Mis Citas'),
                Tab(icon: Icon(Icons.add_circle_outline, size: 18), text: 'Agendar Cita'),
              ],
            ),
            const Divider(height: 1),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildAppointmentsList(scrollController),
                  _buildScheduleForm(scrollController, bottomInset),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppointmentsList(ScrollController controller) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    }
    if (_appointments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.event_note_outlined, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              const Text(
                'No hay citas médicas programadas',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.ink),
              ),
              const SizedBox(height: 6),
              Text(
                'Solicita una nueva cita médica en la pestaña "Agendar Cita".',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                key: const Key('go-to-schedule-tab-button'),
                onPressed: () => _tabController.animateTo(1),
                icon: const Icon(Icons.add),
                label: const Text('Solicitar Cita Ahora'),
                style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      key: const Key('appointments-list-view'),
      controller: controller,
      padding: const EdgeInsets.all(16),
      itemCount: _appointments.length,
      itemBuilder: (context, index) {
        final appt = _appointments[index];
        return Card(
          elevation: 0,
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        appt.specialty,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.ink),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.mint,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        appt.statusLabel,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.tealDark),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.calendar_today, size: 14, color: AppTheme.teal),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${appt.preferredDate} · ${appt.timeSlot}',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.ink),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  appt.reason,
                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildScheduleForm(ScrollController controller, double bottomInset) {
    return ListView(
      controller: controller,
      padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 24),
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Especialidad requerida',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: AppTheme.ink),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _specialties.map((spec) {
                  final selected = _selectedSpecialty == spec;
                  return ChoiceChip(
                    key: Key('specialty-chip-$spec'),
                    label: Text(spec),
                    selected: selected,
                    onSelected: (_) => setState(() => _selectedSpecialty = spec),
                    selectedColor: AppTheme.mint,
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                      color: selected ? AppTheme.tealDark : AppTheme.ink,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('appointment-date-input'),
                controller: _dateController,
                decoration: const InputDecoration(
                  labelText: 'Fecha preferida (AAAA-MM-DD) *',
                  prefixIcon: Icon(Icons.event, color: AppTheme.teal),
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Ingresa la fecha deseada' : null,
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                key: const Key('appointment-timeslot-select'),
                initialValue: _selectedTimeSlot,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Jornada preferida',
                  prefixIcon: Icon(Icons.schedule, color: AppTheme.teal),
                ),
                items: _timeSlots.map((slot) => DropdownMenuItem(value: slot, child: Text(slot))).toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _selectedTimeSlot = v);
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                key: const Key('appointment-reason-input'),
                controller: _reasonController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Motivo de la consulta o síntomas *',
                  hintText: 'Ej. Control periódico de presión arterial...',
                ),
                validator: (v) => v == null || v.trim().length < 5 ? 'Indica el motivo de la cita' : null,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                key: const Key('submit-appointment-button'),
                onPressed: _submitting ? null : _submitAppointment,
                icon: const Icon(Icons.check_circle_outline),
                label: Text(_submitting ? 'Agendando...' : 'Confirmar Agendamiento'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.teal,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
