import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/api/component_permissions_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import 'clinical_labels.dart';

/// Hoja para registrar una nota médica en la historia clínica (POST /medical-notes).
/// Devuelve la nota creada.
Future<Map<String, dynamic>?> showMedicalNoteSheet(BuildContext context, AuthApi api, String historyId) =>
    showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => MedicalNoteSheet(api: api, historyId: historyId),
    );

class MedicalNoteSheet extends StatefulWidget {
  const MedicalNoteSheet({super.key, required this.api, required this.historyId});

  final AuthApi api;
  final String historyId;

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
    widget.api.componentPermissions.form(MedicalNoteSheet.form).then((value) {
      if (!mounted) return;
      setState(() {
        access = value;
        // Igual que la web: sin permiso sobre el campo se usan los valores por defecto.
        if (!access.editable('tipo')) noteType = 'EVOLUTION';
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
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final note = await widget.api.clinical.createNote(historyId: widget.historyId, noteType: noteType, content: toNoteHtml(text), status: status);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(status == 'DRAFT' ? tr('Nota médica guardada como borrador.') : tr('Nota médica firmada y registrada como vigente.')),
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
