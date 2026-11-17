import 'package:flutter/material.dart';
import 'medical_note_sheet.dart';
import 'voice_note_sheet.dart';
import 'clinical_labels.dart';
import '../../core/api/auth_api.dart';
import '../../core/api/clinical_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/models/clinical_history_model.dart';
import '../../core/models/patient_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';

/// Modal para consultar antecedentes médicos, notas de evolución y diagnósticos de manera segura bajo patient:read.
Future<void> showPatientClinicalHistorySheet(
  BuildContext context,
  ClinicalApi api,
  PatientModel patient, {
  AuthApi? auth,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => PatientClinicalHistorySheet(api: api, patient: patient, auth: auth),
  );
}

class PatientClinicalHistorySheet extends StatefulWidget {
  const PatientClinicalHistorySheet({
    super.key,
    required this.api,
    required this.patient,
    this.auth,
  });

  final ClinicalApi api;
  final PatientModel patient;

  /// Sesión completa: permite registrar notas médicas (formulario con privilegios por campo).
  final AuthApi? auth;

  @override
  State<PatientClinicalHistorySheet> createState() => _PatientClinicalHistorySheetState();
}

class _PatientClinicalHistorySheetState extends State<PatientClinicalHistorySheet>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  bool _loading = true;
  String? _error;
  ClinicalHistoryModel? _history;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await widget.api.getClinicalHistory(widget.patient.id);
      if (mounted) {
        setState(() {
          _history = res;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = context.tr('No se pudo cargar la historia clínica del paciente.');
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final patient = widget.patient;

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle superior
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),

            // Encabezado del paciente
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppTheme.teal.withValues(alpha: 0.12),
                    child: const Icon(Icons.person, color: AppTheme.teal, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          patient.fullName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppTheme.ink),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${patient.documentType} ${patient.documentNumber}',
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  if (_history?.bloodType != null && _history!.bloodType!.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade300),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.bloodtype, color: Colors.red, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            _history!.bloodType!,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.red),
                          ),
                        ],
                      ),
                    ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Tab bar médica
            TabBar(
              controller: _tabController,
              labelColor: AppTheme.teal,
              unselectedLabelColor: Colors.grey.shade600,
              indicatorColor: AppTheme.teal,
              indicatorWeight: 3,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              tabs: [
                Tab(text: context.tr('Antecedentes')),
                Tab(text: context.tr('Diagnósticos')),
                Tab(text: context.tr('Evolución')),
              ],
            ),

            // Contenido de la historia
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
                  : _error != null
                      ? ErrorStateView(message: _error!, onRetry: _load)
                      : TabBarView(
                          controller: _tabController,
                          children: [
                            _buildAntecedentesTab(scrollController),
                            _buildDiagnosticosTab(scrollController),
                            _buildEvolucionTab(scrollController),
                          ],
                        ),
            ),
          ],
        ),
      ),
    );
  }

  // --- TAB 1: Antecedentes & Alergias ---
  Widget _buildAntecedentesTab(ScrollController scrollController) {
    final history = _history;
    if (history == null) return _emptyView(context.tr('No hay antecedentes registrados'));

    return ListView(
      key: const Key('clinical-antecedentes-list'),
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      children: [
        // Alergias
        _cardSection(
          title: context.tr('Alergias Conocidas'),
          icon: Icons.warning_amber_rounded,
          iconColor: Colors.orange.shade800,
          child: history.allergies.isEmpty
              ? Text(context.tr('Sin alergias conocidas reportadas.'), style: TextStyle(fontSize: 13, color: Colors.grey))
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: history.allergies.map((a) {
                    final isSevere = a.isSevere;
                    return Chip(
                      label: Text('${a.allergen} (${a.severity})'),
                      backgroundColor: isSevere ? Colors.red.shade50 : Colors.orange.shade50,
                      side: BorderSide(color: isSevere ? Colors.red.shade300 : Colors.orange.shade300),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isSevere ? Colors.red.shade900 : Colors.orange.shade900,
                      ),
                      avatar: Icon(
                        isSevere ? Icons.report_problem : Icons.info_outline,
                        size: 16,
                        color: isSevere ? Colors.red.shade700 : Colors.orange.shade700,
                      ),
                    );
                  }).toList(),
                ),
        ),
        const SizedBox(height: 12),

        // Antecedentes patológicos
        _cardSection(
          title: context.tr('Antecedentes Patológicos'),
          icon: Icons.healing,
          iconColor: AppTheme.teal,
          child: Text(
            history.pathologicalAntecedents?.isNotEmpty == true
                ? history.pathologicalAntecedents!
                : context.tr('Ninguno registrado.'),
            style: const TextStyle(fontSize: 13, color: AppTheme.ink),
          ),
        ),
        const SizedBox(height: 12),

        // Condiciones crónicas
        _cardSection(
          title: context.tr('Condiciones Crónicas'),
          icon: Icons.favorite_border,
          iconColor: Colors.purple,
          child: Text(
            history.chronicConditions?.isNotEmpty == true
                ? history.chronicConditions!
                : context.tr('Sin condiciones crónicas reportadas.'),
            style: const TextStyle(fontSize: 13, color: AppTheme.ink),
          ),
        ),
        const SizedBox(height: 12),

        // Antecedentes familiares y no patológicos
        _cardSection(
          title: context.tr('Antecedentes Familiares y No Patológicos'),
          icon: Icons.family_restroom,
          iconColor: Colors.blueGrey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (history.familyAntecedents != null && history.familyAntecedents!.isNotEmpty) ...[
                Text(context.tr('Familiares:'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                Text(history.familyAntecedents!, style: const TextStyle(fontSize: 13, color: AppTheme.ink)),
                const SizedBox(height: 8),
              ],
              if (history.nonPathologicalAntecedents != null && history.nonPathologicalAntecedents!.isNotEmpty) ...[
                Text(context.tr('No patológicos / Hábitos:'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                Text(history.nonPathologicalAntecedents!, style: const TextStyle(fontSize: 13, color: AppTheme.ink)),
              ],
              if ((history.familyAntecedents == null || history.familyAntecedents!.isEmpty) &&
                  (history.nonPathologicalAntecedents == null || history.nonPathologicalAntecedents!.isEmpty))
                Text(context.tr('Sin datos adicionales registrados.'), style: TextStyle(fontSize: 13, color: Colors.grey)),
            ],
          ),
        ),
      ],
    );
  }

  // --- TAB 2: Diagnósticos & Medicación ---
  Widget _buildDiagnosticosTab(ScrollController scrollController) {
    final history = _history;
    if (history == null) return _emptyView(context.tr('No hay diagnósticos ni medicamentos registrados'));

    return ListView(
      key: const Key('clinical-diagnosticos-list'),
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      children: [
        // Diagnósticos de base
        _cardSection(
          title: context.tr('Diagnósticos de Base (CIE-10)'),
          icon: Icons.assignment_outlined,
          iconColor: AppTheme.teal,
          child: history.baseDiagnoses.isEmpty
              ? Text(context.tr('Sin diagnósticos de base registrados.'), style: TextStyle(fontSize: 13, color: Colors.grey))
              : Column(
                  children: history.baseDiagnoses.map((d) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.mint,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              d.code,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.teal),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(d.description, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.ink)),
                                if (d.diagnosedAt != null)
                                  Text(
                                    tr('Diagnóstico: {date}', {'date': formatDate(d.diagnosedAt!.toIso8601String())}),
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
        ),
        const SizedBox(height: 12),

        // Medicamentos actuales
        _cardSection(
          title: context.tr('Medicación Actual Prescrita'),
          icon: Icons.medication_outlined,
          iconColor: Colors.indigo,
          child: history.currentMedications.isEmpty
              ? Text(context.tr('Sin medicación activa prescrita.'), style: TextStyle(fontSize: 13, color: Colors.grey))
              : Column(
                  children: history.currentMedications.map((m) {
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.circle, size: 8, color: Colors.indigo),
                      title: Text(m.medicationName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      subtitle: Text('${m.dosage} ${m.frequency != null ? '· ${m.frequency}' : ''}'),
                    );
                  }).toList(),
                ),
        ),
      ],
    );
  }

  // --- TAB 3: Evolución y Notas Médicas ---
  Widget _buildEvolucionTab(ScrollController scrollController) {
    final history = _history;
    final notes = history?.recentNotes ?? [];

    if (notes.isEmpty) {
      return Column(children: [
        _newNoteButton(),
        Expanded(child: _emptyView(context.tr('No hay notas de evolución clínica registradas para este paciente'))),
      ]);
    }

    return Column(children: [
      _newNoteButton(),
      Expanded(child: ListView.builder(
      key: const Key('clinical-notes-list'),
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: notes.length,
      itemBuilder: (context, index) {
        final note = notes[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade300),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.teal.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        note.noteType.toUpperCase(),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.teal),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      formatDate(note.createdAt.toIso8601String(), withTime: true),
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  // Las notas se guardan como HTML (igual que la web); aquí se muestran como texto.
                  plainText(note.content),
                  style: const TextStyle(fontSize: 13, color: AppTheme.ink, height: 1.4),
                ),
                if (note.authorName != null && note.authorName!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    tr('Profesional: {name}', {'name': note.authorName}),
                    style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey.shade600),
                  ),
                ],
                if (widget.auth != null && note.status != 'VOIDED') ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (note.status == 'DRAFT')
                        TextButton.icon(
                          key: Key('note-approve-${note.id}'),
                          onPressed: () => _changeNoteStatus(note.id, 'APPROVED'),
                          icon: const Icon(Icons.verified_outlined, size: 18),
                          label: Text(context.tr('Emitir')),
                        ),
                      TextButton.icon(
                        key: Key('note-void-${note.id}'),
                        onPressed: () => _changeNoteStatus(note.id, 'VOIDED'),
                        icon: Icon(Icons.block, size: 18, color: Colors.red.shade700),
                        label: Text(context.tr('Anular'), style: TextStyle(color: Colors.red.shade700)),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        );
      },
    )),
    ]);
  }

  Widget _newNoteButton() {
    final auth = widget.auth;
    if (auth == null) return const SizedBox.shrink();
    // Sin medical_note:create no se ofrece ninguna acción de alta de notas (el backend lo exige igualmente).
    final canCreateNote = auth.permissions.value.can(Permissions.medicalNoteCreate);
    if (!canCreateNote) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Align(
        alignment: Alignment.centerRight,
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.end,
          children: [
            OutlinedButton.icon(
              key: const Key('clinical-dictate-note'),
              onPressed: _dictateNote,
              icon: const Icon(Icons.mic_none_rounded, size: 18),
              label: Text(context.tr('Dictar nota')),
            ),
            FilledButton.icon(
              key: const Key('clinical-new-note'),
              onPressed: _createNote,
              icon: const Icon(Icons.add, size: 18),
              label: Text(context.tr('Nueva nota médica')),
            ),
          ],
        ),
      ),
    );
  }

  /// Abre el formulario de nota (borrador o emisión directa) y recarga la historia.
  Future<void> _createNote() async {
    final auth = widget.auth;
    final history = _history;
    if (auth == null || history == null) return;
    final created = await showMedicalNoteSheet(context, auth, history.id);
    if (created != null) await _load();
  }

  /// Dictado por voz: graba, envía a la IA y abre el formulario precargado. Nada se guarda sin confirmación.
  Future<void> _dictateNote() async {
    final auth = widget.auth;
    final history = _history;
    if (auth == null || history == null) return;
    final result = await showVoiceNoteSheet(context, auth, history.id);
    if (!mounted || result == null) return;
    final created = await showMedicalNoteSheet(context, auth, history.id, draft: result.draft);
    if (created != null) await _load();
  }

  /// Emitir (DRAFT → APPROVED) o anular (→ VOIDED), igual que la web (requiere `medical_note:update`).
  Future<void> _changeNoteStatus(String noteId, String status) async {
    if (status == 'VOIDED') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ctx.tr('Anular nota médica')),
          content: Text(ctx.tr('La nota quedará anulada y no podrá usarse como vigente.')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ctx.tr('Cancelar'))),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(ctx.tr('Anular')),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    try {
      await widget.api.changeNoteStatus(noteId, status);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(status == 'APPROVED' ? context.tr('Nota médica emitida como vigente.') : context.tr('Nota médica anulada.')),
      ));
      await _load();
    } on ApiException catch (exception) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(exception.message), backgroundColor: Colors.red.shade700));
    }
  }

  Widget _cardSection({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Widget child,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: iconColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.ink)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget _emptyView(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.notes_outlined, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }
}
