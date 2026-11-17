import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';

/// Hoja de alta de expediente (POST /expedients). Devuelve el expediente creado.
Future<Map<String, dynamic>?> showCreateExpedientSheet(BuildContext context, AuthApi api) => showModalBottomSheet<Map<String, dynamic>>(
  context: context,
  isScrollControlled: true,
  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
  builder: (_) => CreateExpedientSheet(api: api),
);

class CreateExpedientSheet extends StatefulWidget {
  const CreateExpedientSheet({super.key, required this.api});

  final AuthApi api;

  @override
  State<CreateExpedientSheet> createState() => _CreateExpedientSheetState();
}

class _CreateExpedientSheetState extends State<CreateExpedientSheet> {
  final _formKey = GlobalKey<FormState>();
  final code = TextEditingController();
  final name = TextEditingController();
  final description = TextEditingController();
  List<Map<String, dynamic>> types = [];
  String? typeId;
  bool loading = true;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _loadTypes();
  }

  @override
  void dispose() {
    code.dispose();
    name.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> _loadTypes() async {
    try {
      final result = ((await widget.api.expedients.types())['content'] as List<dynamic>).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        types = result;
        if (result.length == 1) typeId = result.first['id'] as String?;
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final created = await widget.api.expedients.create(
        expedientTypeId: typeId!,
        code: code.text,
        name: name.text,
        description: description.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Expediente {code} creado.', {'code': created['code'] ?? ''}))));
      Navigator.of(context).pop(created);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? tr('Campo obligatorio') : null;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + MediaQuery.of(context).viewInsets.bottom),
    child: SingleChildScrollView(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Text(context.tr('Nuevo expediente'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink)),
            const SizedBox(height: 16),
            if (loading)
              const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(color: AppTheme.teal)))
            else ...[
              DropdownButtonFormField<String>(
                key: const Key('expedient-type'),
                initialValue: typeId,
                isExpanded: true,
                decoration: InputDecoration(labelText: '${context.tr('Tipo de expediente')} *'),
                items: [for (final type in types) DropdownMenuItem(value: type['id'] as String, child: Text('${type['name']} · ${type['code'] ?? ''}'))],
                onChanged: saving ? null : (value) => setState(() => typeId = value),
                validator: (value) => value == null ? tr('Campo obligatorio') : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('expedient-code'),
                controller: code,
                enabled: !saving,
                maxLength: 60,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(labelText: '${context.tr('Código')} *', hintText: 'EXP-2026-001'),
                validator: _required,
              ),
              TextFormField(
                key: const Key('expedient-name'),
                controller: name,
                enabled: !saving,
                maxLength: 200,
                decoration: InputDecoration(labelText: '${context.tr('Nombre')} *'),
                validator: _required,
              ),
              TextFormField(
                controller: description,
                enabled: !saving,
                minLines: 2,
                maxLines: 4,
                maxLength: 10000,
                decoration: InputDecoration(labelText: context.tr('Descripción')),
              ),
            ],
            if (error != null) ...[
              Text(error!, key: const Key('expedient-error'), style: TextStyle(color: Colors.red.shade700)),
              const SizedBox(height: 8),
            ],
            FilledButton.icon(
              key: const Key('expedient-submit'),
              onPressed: saving || loading || types.isEmpty ? null : submit,
              style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
              icon: saving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.create_new_folder_outlined),
              label: Text(saving ? context.tr('Guardando…') : context.tr('Crear expediente')),
            ),
          ],
        ),
      ),
    ),
  );
}
