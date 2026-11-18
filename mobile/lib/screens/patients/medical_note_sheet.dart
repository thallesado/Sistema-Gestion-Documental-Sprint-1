import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/api/component_permissions_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import 'clinical_labels.dart';
import 'note_emission_dialog.dart';

/// Hoja para registrar una nota médica en la historia clínica (POST /medical-notes).
/// Devuelve la nota creada.
/// Si se pasa [draft] (borrador de `POST /medical-notes/ai-draft`), el formulario se precarga con él.
/// Nada se guarda hasta que el médico pulsa Guardar borrador o Firmar y emitir.
Future<Map<String, dynamic>?> showMedicalNoteSheet(BuildContext context, AuthApi api, String historyId, {Map<String, dynamic>? draft}) =>
    showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => MedicalNoteSheet(api: api, historyId: historyId, draft: draft),
    );

/// Secciones SOAP del borrador de IA en texto plano; `toNoteHtml` lo convierte al guardar.
String aiDraftText(Map<String, dynamic> draft) {
  final sections = [
    (tr('Subjetivo'), '${draft['subjective'] ?? ''}'.trim()),
    (tr('Objetivo'), '${draft['objective'] ?? ''}'.trim()),
    (tr('Evaluación'), '${draft['assessment'] ?? ''}'.trim()),
    (tr('Plan'), '${draft['plan'] ?? ''}'.trim()),
  ];
  return sections.where((s) => s.$2.isNotEmpty).map((s) => '${s.$1}:\n${s.$2}').join('\n\n');
}

/// Advertencias del borrador (`warnings[]` del backend): alergias y medicamentos ya registrados.
List<Map<String, dynamic>> aiDraftWarnings(Map<String, dynamic>? draft) {
  final raw = draft?['warnings'];
  if (raw is! List) return const [];
  return raw.whereType<Map>().map((w) => Map<String, dynamic>.from(w)).toList();
}

String aiWarningLabel(Map<String, dynamic> warning) {
  final term = '${warning['term'] ?? ''}';
  final prefix = warning['type'] == 'ALLERGY' ? tr('Posible alergia registrada') : tr('Posible medicamento actual');
  return '$prefix: $term';
}

class MedicalNoteSheet extends StatefulWidget {
  const MedicalNoteSheet({super.key, required this.api, required this.historyId, this.draft});

  final AuthApi api;
  final String historyId;
  final Map<String, dynamic>? draft;

  static const form = 'nota_medica';

  @override
  State<MedicalNoteSheet> createState() => _MedicalNoteSheetState();
}

class _MedicalNoteSheetState extends State<MedicalNoteSheet> {
  final content = TextEditingController();
  FormAccess access = FormAccess.open;
  String noteType = 'EVOLUTION';
  String status = 'DRAFT';
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    final draft = widget.draft;
    if (draft != null) {
      content.text = aiDraftText(draft);
    }
    widget.api.componentPermissions.form(MedicalNoteSheet.form).then((value) {
      if (!mounted) return;
      setState(() {
        access = value;
        // Igual que la web: sin permiso sobre el campo se usan los valores por defecto.
        if (!access.editable('tipo')) {
          noteType = 'EVOLUTION';
        } else {
          final suggested = draft?['noteType'];
          if (suggested is String && noteTypes.contains(suggested)) noteType = suggested;
        }
        if (!access.editable('estado')) status = 'DRAFT';
      });
    }, onError: (_) {});
  }

  @override
  void dispose() {
    content.dispose();
    super.dispose();
  }

  Future<void> save() async {
    final text = content.text.trim();
    if (text.isEmpty) {
      setState(() => error = tr('Escribe el contenido de la nota.'));
      return;
    }
    final emit = status == 'APPROVED';
    if (emit && (!await confirmNoteEmission(context) || !mounted)) return;
    setState(() {
      saving = true;
      error = null;
    });
    try {
      // El backend solo crea notas en BORRADOR; emitir es un segundo paso (PATCH de estado).
      var note = await widget.api.clinical.createNote(historyId: widget.historyId, noteType: noteType, content: toNoteHtml(text));
      if (emit) {
        try {
          note = {...note, ...await widget.api.clinical.changeNoteStatus(note['id'] as String, 'APPROVED')};
        } on ApiException catch (exception) {
          // La nota ya existe como borrador: se informa y se cierra para no duplicarla al reintentar.
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(tr('Nota guardada como borrador, pero no se pudo emitir: {error}', {'error': exception.message})),
            backgroundColor: Colors.red.shade700,
          ));
          Navigator.of(context).pop(note);
          return;
        }
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(emit ? tr('Nota médica firmada y registrada como vigente.') : tr('Nota médica guardada como borrador.')),
      ));
      Navigator.of(context).pop(note);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + MediaQuery.of(context).viewInsets.bottom),
    child: SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Text(context.tr('Nueva nota médica'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 16),
          if (widget.draft != null) ...[
            Text(
              context.tr('Borrador generado con IA. Revísalo antes de guardar: la IA no guarda nada por sí sola.'),
              key: const Key('note-ai-hint'),
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            const SizedBox(height: 12),
          ],
          if (aiDraftWarnings(widget.draft).isNotEmpty) ...[
            Container(
              key: const Key('note-warnings'),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF4E5),
                border: Border.all(color: const Color(0xFFF59E0B)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFB45309), size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(context.tr('Revisa estas coincidencias antes de guardar.'), style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF92400E)))),
                  ]),
                  const SizedBox(height: 6),
                  for (final warning in aiDraftWarnings(widget.draft))
                    Padding(
                      padding: const EdgeInsets.only(left: 28, top: 2),
                      child: Text(aiWarningLabel(warning), key: Key('note-warning-${warning['type']}-${warning['term']}'), style: const TextStyle(color: Color(0xFF92400E))),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (access.visible('tipo')) ...[
            Text(context.tr('Tipo de nota'), style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final type in noteTypes)
                  ChoiceChip(
                    key: Key('note-type-$type'),
                    label: Text(noteTypeLabel(type)),
                    selected: noteType == type,
                    selectedColor: AppTheme.mint,
                    onSelected: access.editable('tipo') && !saving ? (_) => setState(() => noteType = type) : null,
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            key: const Key('note-content'),
            controller: content,
            enabled: !saving,
            minLines: 5,
            maxLines: 12,
            maxLength: 20000,
            decoration: InputDecoration(
              labelText: '${context.tr('Contenido')} *',
              hintText: context.tr('Motivo, hallazgos, diagnóstico / evolución y plan…'),
              alignLabelWithHint: true,
            ),
          ),
          if (access.visible('estado'))
            SwitchListTile(
              key: const Key('note-sign'),
              contentPadding: EdgeInsets.zero,
              title: Text(context.tr('Firmar y emitir como vigente'), style: const TextStyle(fontSize: 14)),
              subtitle: Text(
                context.tr('Si lo desactivas, la nota queda como borrador y podrás emitirla después.'),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              value: status == 'APPROVED',
              activeThumbColor: AppTheme.teal,
              onChanged: access.editable('estado') && !saving ? (value) => setState(() => status = value ? 'APPROVED' : 'DRAFT') : null,
            ),
          if (error != null) ...[
            Text(error!, key: const Key('note-error'), style: TextStyle(color: Colors.red.shade700)),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 8),
          FilledButton.icon(
            key: const Key('note-save'),
            onPressed: saving ? null : save,
            style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
            icon: saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Icon(status == 'DRAFT' ? Icons.save_outlined : Icons.draw_outlined),
            label: Text(saving ? context.tr('Guardando…') : status == 'DRAFT' ? context.tr('Guardar borrador') : context.tr('Firmar y emitir')),
          ),
        ],
      ),
    ),
  );
}
