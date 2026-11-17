import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/workflow_instance_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../../core/i18n/app_language.dart';

/// Abre la hoja modal para iniciar un workflow de revisión/aprobación sobre un documento.
Future<bool> showStartWorkflowSheet(
  BuildContext context,
  AuthApi api, {
  required String documentId,
  required String documentName,
}) async =>
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StartWorkflowSheet(
        api: api,
        documentId: documentId,
        documentName: documentName,
      ),
    ) ??
    false;

class StartWorkflowSheet extends StatefulWidget {
  const StartWorkflowSheet({
    super.key,
    required this.api,
    required this.documentId,
    required this.documentName,
  });

  final AuthApi api;
  final String documentId;
  final String documentName;

  @override
  State<StartWorkflowSheet> createState() => _StartWorkflowSheetState();
}

class _StartWorkflowSheetState extends State<StartWorkflowSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController =
      TextEditingController(text: tr('Trámite: {name}', {'name': widget.documentName}));
  final _descriptionController = TextEditingController();

  List<WorkflowTemplateModel> _templates = [];
  String? _selectedTemplateId;
  int _priority = 2;
  bool _loading = true;
  bool _submitting = false;
  String? _loadError;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _loadTemplates();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadTemplates() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final result = await widget.api.workflows.getDocumentTemplates();
      if (!mounted) return;
      setState(() {
        _templates = result;
        if (result.isNotEmpty) {
          _selectedTemplateId = result.first.id;
        }
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => _loadError = exception.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedTemplateId == null) {
      setState(() => _submitError = context.tr('Selecciona una plantilla de flujo.'));
      return;
    }
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      await widget.api.workflows.startDocumentWorkflow(
        templateId: _selectedTemplateId!,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        documentId: widget.documentId,
        priority: _priority,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (exception) {
      if (mounted) setState(() => _submitError = exception.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Row(
              children: [
                const Icon(Icons.play_circle_outline, color: AppTheme.teal),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    context.tr('Iniciar flujo de aprobación'),
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: AppTheme.teal)),
              )
            else if (_loadError != null)
              SizedBox(
                height: 220,
                child: ErrorStateView(message: _loadError!, onRetry: _loadTemplates),
              )
            else if (_templates.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Column(
                  children: [
                    Icon(Icons.account_tree_outlined, size: 42, color: Colors.grey.shade400),
                    const SizedBox(height: 10),
                    Text(
                      context.tr('No hay plantillas activas disponibles para documentos en tu organización.'),
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey.shade700),
                    ),
                  ],
                ),
              )
            else
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_submitError != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Text(_submitError!, style: TextStyle(color: Colors.red.shade800, fontSize: 13)),
                      ),
                    DropdownButtonFormField<String>(
                      key: const Key('workflow-template-select'),
                      initialValue: _selectedTemplateId,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: context.tr('Plantilla de trámite *'),
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.account_tree_outlined),
                      ),
                      items: [
                        for (final t in _templates)
                          DropdownMenuItem<String>(
                            value: t.id,
                            child: Text(
                              '${t.name}${t.category != null ? ' (${t.category})' : ''}${t.stepsCount > 0 ? ' · ${t.stepsCount} etapas' : ''}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: _submitting ? null : (v) => setState(() => _selectedTemplateId = v),
                      validator: (v) => v == null ? context.tr('Selecciona una plantilla.') : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('workflow-title-input'),
                      controller: _titleController,
                      enabled: !_submitting,
                      decoration: InputDecoration(
                        labelText: context.tr('Título del trámite *'),
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.title),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? context.tr('El título es obligatorio.') : null,
                    ),
                    const SizedBox(height: 12),
                    Text(context.tr('Prioridad'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.ink)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final p in [1, 2, 3, 4])
                          ChoiceChip(
                            label: Text(priorityLabel(p)),
                            selected: _priority == p,
                            selectedColor: AppTheme.mint,
                            onSelected: _submitting ? null : (_) => setState(() => _priority = p),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('workflow-description-input'),
                      controller: _descriptionController,
                      enabled: !_submitting,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: context.tr('Notas o instrucciones (opcional)'),
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.notes_outlined),
                      ),
                    ),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      key: const Key('workflow-start-submit'),
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.teal,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.play_arrow),
                      label: Text(_submitting ? context.tr('Iniciando...') : context.tr('Iniciar trámite')),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
