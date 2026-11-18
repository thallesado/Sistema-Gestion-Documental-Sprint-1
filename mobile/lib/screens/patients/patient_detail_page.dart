import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/api/component_permissions_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/state_views.dart';
import '../documents/create_document_page.dart';
import '../documents/document_detail_sheet.dart';
import 'clinical_history_form_page.dart';
import 'clinical_labels.dart';
import 'medical_note_sheet.dart';
import 'widgets/summary_card.dart';

/// Ficha clínica del paciente: resumen, historia clínica, notas médicas, documentos
/// vinculados y cronología, con los mismos endpoints que el módulo clínico de la web.
class PatientDetailPage extends StatefulWidget {
  const PatientDetailPage({super.key, required this.api, required this.patientId, this.patient});

  final AuthApi api;
  final String patientId;

  /// Datos del listado para mostrar el nombre mientras se carga la ficha.
  final Map<String, dynamic>? patient;

  @override
  State<PatientDetailPage> createState() => _PatientDetailPageState();
}

class _PatientDetailPageState extends State<PatientDetailPage> {
  Map<String, dynamic>? patient;
  Map<String, dynamic>? history;
  Map<String, dynamic>? summary;
  String? summaryError;
  List<Map<String, dynamic>> notes = [];
  String? notesError;
  List<Map<String, dynamic>> documents = [];
  String? documentsError;
  List<Map<String, dynamic>> timeline = [];
  String? timelineError;
  FormAccess noteAccess = FormAccess.open;
  bool loading = true;
  String? error;
  String? updatingNoteId;

  UserPermissions get permissions => widget.api.permissions.value;

  @override
  void initState() {
    super.initState();
    patient = widget.patient;
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait<Object?>([
        widget.api.clinical.patient(widget.patientId),
        widget.api.clinical.historyForPatient(widget.patientId),
      ]);
      if (!mounted) return;
      setState(() {
        patient = results[0] as Map<String, dynamic>;
        history = results[1] as Map<String, dynamic>?;
      });
      await Future.wait([_loadSummary(), _loadHistoryData()]);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  /// Cada bloque secundario falla por separado: un 403 en notas no oculta la historia.
  Future<String?> _safe(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } on SessionExpiredException {
      rethrow;
    } on ApiException catch (exception) {
      return exception.isForbidden ? tr('Tu perfil no tiene acceso a esta sección.') : exception.message;
    }
  }

  Future<void> _loadSummary() async {
    if (!permissions.can(Permissions.medicalNoteRead)) return;
    final failure = await _safe(() async {
      final result = await widget.api.clinical.quickSummary(widget.patientId);
      if (mounted) setState(() => summary = result);
    });
    if (mounted) setState(() => summaryError = failure);
  }

  Future<void> _loadHistoryData() async {
    final current = history;
    if (current == null) return;
    final id = current['id'] as String;
    await Future.wait([
      if (permissions.can(Permissions.medicalNoteRead)) _loadNotes(),
      _safe(() async {
        final result = await widget.api.clinical.linkedDocuments(id);
        if (mounted) setState(() => documents = result);
      }).then((failure) {
        if (mounted) setState(() => documentsError = failure);
      }),
      _safe(() async {
        final result = await widget.api.clinical.timeline(id);
        if (mounted) setState(() => timeline = result);
      }).then((failure) {
        if (mounted) setState(() => timelineError = failure);
      }),
      widget.api.componentPermissions.form(MedicalNoteSheet.form).then((access) {
        if (mounted) setState(() => noteAccess = access);
      }),
    ]);
  }

  Future<void> _loadNotes() async {
    final current = history;
    if (current == null) return;
    final failure = await _safe(() async {
      final result = await widget.api.clinical.notes(current['id'] as String);
      if (mounted) setState(() => notes = result);
    });
    if (mounted) setState(() => notesError = failure);
  }

  Future<void> editHistory() async {
    final saved = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => ClinicalHistoryFormPage(api: widget.api, patientId: widget.patientId, history: history)),
    );
    if (saved == null || !mounted) return;
    setState(() => history = saved);
    await Future.wait([_loadSummary(), _loadHistoryData()]);
  }

  Future<void> addNote() async {
    final current = history;
    if (current == null) return;
    final note = await showMedicalNoteSheet(context, widget.api, current['id'] as String);
    if (note == null || !mounted) return;
    await Future.wait([_loadNotes(), _loadSummary()]);
  }

  Future<void> changeNoteStatus(Map<String, dynamic> note, String status) async {
    if (status == 'VOIDED') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ctx.tr('Anular nota médica')),
          content: Text(ctx.tr('La nota quedará anulada y no podrá volver a emitirse.')),
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
      if (confirmed != true || !mounted) return;
    }
    setState(() => updatingNoteId = note['id'] as String?);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.api.clinical.changeNoteStatus(note['id'] as String, status);
      messenger.showSnackBar(SnackBar(
        content: Text(status == 'APPROVED' ? tr('Nota médica emitida como vigente.') : tr('Nota médica anulada.')),
      ));
      await _loadNotes();
    } on ApiException catch (exception) {
      messenger.showSnackBar(SnackBar(content: Text(exception.message), backgroundColor: Colors.red.shade700));
    } finally {
      if (mounted) setState(() => updatingNoteId = null);
    }
  }

  Future<void> newDocument() async {
    final p = patient ?? const {};
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => CreateDocumentPage(
          api: widget.api,
          initialPatient: PickerOption(widget.patientId, _name(p)),
        ),
      ),
    );
    if (created == null || !mounted) return;
    final current = history;
    if (current != null && permissions.canAny([Permissions.clinicalDocumentLink, Permissions.patientUpdate])) {
      await _safe(() => widget.api.clinical.linkDocument(current['id'] as String, created['id'] as String));
    }
    await _loadHistoryData();
  }

  static String _name(Map<String, dynamic> p) => '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim();

  @override
  Widget build(BuildContext context) {
    final p = patient;
    final tabs = <(String, Widget)>[
      (context.tr('Resumen'), _summaryTab()),
      (context.tr('Historia'), _historyTab()),
      if (permissions.can(Permissions.medicalNoteRead)) (context.tr('Notas'), _notesTab()),
      (context.tr('Documentos'), _documentsTab()),
      (context.tr('Cronología'), _timelineTab()),
    ];
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: Colors.white,
          title: Text(p == null ? context.tr('Paciente') : _name(p), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppTheme.teal,
            indicatorColor: AppTheme.teal,
            tabs: [for (final tab in tabs) Tab(text: tab.$1)],
          ),
        ),
        body: loading && history == null && error == null
            ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
            : error != null
            ? ErrorStateView(message: error!, onRetry: load)
            : TabBarView(children: [for (final tab in tabs) tab.$2]),
      ),
    );
  }

  Widget _scroll(List<Widget> children) => RefreshIndicator(
    onRefresh: load,
    color: AppTheme.teal,
    child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(16), children: children),
  );

  Widget _summaryTab() {
    final p = patient ?? const <String, dynamic>{};
    return _scroll([
      SectionCard(
        title: context.tr('Datos del paciente'),
        icon: Icons.person_outline,
        trailing: p['status'] == null ? null : StatusBadge(patientStatusLabel(p['status'] as String?), tone: p['status'] == 'ACTIVE' ? BadgeTone.success : BadgeTone.neutral),
        children: [
          InfoRow(patientDocumentTypeLabel(p['documentType'] as String?), p['documentNumber']),
          InfoRow(context.tr('Fecha de nacimiento'), p['birthDate'] == null ? null : formatDate(p['birthDate'])),
          InfoRow(context.tr('Género'), p['gender'] == null ? null : genderLabel(p['gender'] as String?)),
          InfoRow(context.tr('Teléfono'), p['phone']),
          InfoRow(context.tr('Correo electrónico'), p['email']),
        ],
      ),
      if (history != null)
        SectionCard(
          title: context.tr('Historia clínica'),
          icon: Icons.assignment_ind_outlined,
          children: [
            InfoRow(context.tr('Código'), history!['code']),
            InfoRow(context.tr('Grupo sanguíneo'), history!['bloodType']),
            InfoRow(context.tr('Última actualización'), formatDate(history!['updatedAt'], withTime: true)),
          ],
        ),
      if (summary != null) SummaryCard(summary: summary!),
      if (summaryError != null) Text(summaryError!, style: TextStyle(color: Colors.grey.shade600)),
    ]);
  }

  Widget _historyTab() {
    final h = history;
    if (h == null) {
      return _scroll([
        const SizedBox(height: 24),
        Icon(Icons.assignment_late_outlined, size: 48, color: Colors.grey.shade400),
        const SizedBox(height: 12),
        Text(context.tr('Este paciente aún no tiene historia clínica.'), textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade700)),
        const SizedBox(height: 16),
        if (permissions.can(Permissions.patientCreate))
          Center(
            child: FilledButton.icon(
              key: const Key('history-open'),
              onPressed: editHistory,
              style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
              icon: const Icon(Icons.note_add_outlined),
              label: Text(context.tr('Abrir historia clínica')),
            ),
          ),
      ]);
    }
    List<Map<String, dynamic>> list(String key) => ((h[key] as List<dynamic>?) ?? const []).whereType<Map<String, dynamic>>().toList();
    final allergies = list('allergies');
    final medications = list('currentMedications');
    final diagnoses = list('baseDiagnoses');
    return _scroll([
      if (permissions.can(Permissions.patientUpdate))
        Align(
          alignment: Alignment.centerRight,
          child: OutlinedButton.icon(
            key: const Key('history-edit'),
            onPressed: editHistory,
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: Text(context.tr('Editar historia')),
          ),
        ),
      const SizedBox(height: 8),
      SectionCard(
        title: '${context.tr('Historia clínica')} ${h['code'] ?? ''}',
        icon: Icons.assignment_ind_outlined,
        children: [
          InfoRow(context.tr('Grupo sanguíneo'), h['bloodType']),
          InfoRow(context.tr('Condiciones crónicas'), h['chronicConditions']),
        ],
      ),
      SectionCard(
        title: context.tr('Antecedentes'),
        icon: Icons.history_edu_outlined,
        children: [
          InfoRow(context.tr('Antecedentes patológicos'), h['pathologicalAntecedents']),
          InfoRow(context.tr('Antecedentes no patológicos'), h['nonPathologicalAntecedents']),
          InfoRow(context.tr('Antecedentes familiares'), h['familyAntecedents']),
        ],
      ),
      SectionCard(
        title: context.tr('Alergias'),
        icon: Icons.warning_amber_outlined,
        children: [
          if (allergies.isEmpty) Text(context.tr('Ninguna registrada'), style: TextStyle(color: Colors.grey.shade600)),
          for (final a in allergies)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(a['allergen'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: (a['reaction'] as String?)?.isNotEmpty ?? false ? Text(a['reaction'] as String) : null,
              trailing: StatusBadge(severityLabel(a['severity'] as String?), tone: severityTone(a['severity'] as String?)),
            ),
        ],
      ),
      SectionCard(
        title: context.tr('Medicación actual'),
        icon: Icons.medication_outlined,
        children: [
          if (medications.isEmpty) Text(context.tr('Sin medicación registrada'), style: TextStyle(color: Colors.grey.shade600)),
          for (final m in medications)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(m['name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text([m['dose'], m['frequency']].where((v) => v != null && '$v'.isNotEmpty).join(' · ')),
            ),
        ],
      ),
      SectionCard(
        title: context.tr('Diagnósticos base'),
        icon: Icons.assignment_outlined,
        children: [
          if (diagnoses.isEmpty) Text(context.tr('Ninguno registrado'), style: TextStyle(color: Colors.grey.shade600)),
          for (final d in diagnoses)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(d['description'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text([d['code'], d['diagnosedAt']].where((v) => v != null && '$v'.isNotEmpty).join(' · ')),
            ),
        ],
      ),
      SectionCard(
        title: context.tr('Observaciones'),
        icon: Icons.notes_outlined,
        children: [Text((h['observations'] as String?)?.isNotEmpty ?? false ? h['observations'] as String : '—')],
      ),
    ]);
  }

  Widget _needsHistory() => _scroll([
    const SizedBox(height: 32),
    Text(context.tr('Abre la historia clínica del paciente para usar esta sección.'), textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
  ]);

  Widget _notesTab() {
    if (history == null) return _needsHistory();
    final canChange = permissions.can(Permissions.medicalNoteUpdate) && noteAccess.editable('estado');
    return Stack(
      children: [
        _scroll([
          if (notesError != null) Text(notesError!, style: TextStyle(color: Colors.red.shade700)),
          if (notes.isEmpty && notesError == null)
            Padding(
              padding: const EdgeInsets.only(top: 32),
              child: Text(context.tr('Sin notas médicas registradas.'), textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
            ),
          for (final note in notes)
            Card(
              key: Key('note-${note['id']}'),
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(noteTypeLabel(note['noteType'] as String?), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.tealDark))),
                        StatusBadge(noteStatusLabel(note['status'] as String?), tone: noteStatusTone(note['status'] as String?)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(formatDate(note['createdAt'], withTime: true), style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    const SizedBox(height: 8),
                    Text(plainText(note['content'] as String?), style: const TextStyle(fontSize: 13, height: 1.35)),
                    if (canChange && note['status'] == 'DRAFT') ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          FilledButton.tonalIcon(
                            key: Key('note-approve-${note['id']}'),
                            onPressed: updatingNoteId != null ? null : () => changeNoteStatus(note, 'APPROVED'),
                            icon: const Icon(Icons.draw_outlined, size: 18),
                            label: Text(context.tr('Emitir')),
                          ),
                          TextButton.icon(
                            key: Key('note-void-${note['id']}'),
                            onPressed: updatingNoteId != null ? null : () => changeNoteStatus(note, 'VOIDED'),
                            icon: Icon(Icons.block, size: 18, color: Colors.red.shade700),
                            label: Text(context.tr('Anular'), style: TextStyle(color: Colors.red.shade700)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          const SizedBox(height: 72),
        ]),
        if (permissions.can(Permissions.medicalNoteCreate))
          Positioned(
            right: 16,
            bottom: 16,
            child: FloatingActionButton.extended(
              key: const Key('note-add'),
              heroTag: 'note-add',
              onPressed: addNote,
              backgroundColor: AppTheme.teal,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.edit_note),
              label: Text(context.tr('Nueva nota')),
            ),
          ),
      ],
    );
  }

  Widget _documentsTab() {
    if (history == null) return _needsHistory();
    return _scroll([
      if (permissions.can(Permissions.documentCreate))
        Align(
          alignment: Alignment.centerRight,
          child: OutlinedButton.icon(
            key: const Key('patient-new-document'),
            onPressed: newDocument,
            icon: const Icon(Icons.note_add_outlined, size: 18),
            label: Text(context.tr('Nuevo documento')),
          ),
        ),
      const SizedBox(height: 8),
      if (documentsError != null) Text(documentsError!, style: TextStyle(color: Colors.red.shade700)),
      if (documents.isEmpty && documentsError == null)
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Text(context.tr('No hay documentos vinculados a la historia clínica.'), textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
        ),
      for (final doc in documents)
        Card(
          elevation: 0,
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
          child: ListTile(
            leading: const Icon(Icons.description_outlined, color: AppTheme.teal),
            title: Text(doc['name'] as String? ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text('${doc['code'] ?? ''} · ${doc['documentTypeName'] ?? ''}', style: const TextStyle(fontSize: 12)),
            trailing: StatusBadge(documentStatusLabel(doc['status'] as String?), tone: documentStatusTone(doc['status'] as String?)),
            onTap: permissions.can(Permissions.documentRead) ? () => showDocumentDetail(context, widget.api, doc['id'] as String) : null,
          ),
        ),
    ]);
  }

  Widget _timelineTab() {
    if (history == null) return _needsHistory();
    return _scroll([
      if (timelineError != null) Text(timelineError!, style: TextStyle(color: Colors.red.shade700)),
      if (timeline.isEmpty && timelineError == null)
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Text(context.tr('Sin eventos registrados.'), textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
        ),
      for (final event in timeline)
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                children: [
                  Container(width: 10, height: 10, margin: const EdgeInsets.only(top: 6), decoration: const BoxDecoration(color: AppTheme.teal, shape: BoxShape.circle)),
                  Expanded(child: Container(width: 2, color: AppTheme.mint)),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(timelineEventLabel(event['eventType'] as String?), style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(formatDate(event['occurredAt'], withTime: true), style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      if ((event['description'] as String?)?.isNotEmpty ?? false) ...[
                        const SizedBox(height: 4),
                        Text(plainText(event['description'] as String), maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
    ]);
  }
}
