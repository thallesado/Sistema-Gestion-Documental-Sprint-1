import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/form_fields.dart';
import 'clinical_labels.dart';

/// Registro de paciente (POST /patients, requiere `patient:create`). Devuelve el paciente creado.
Future<Map<String, dynamic>?> showCreatePatientSheet(BuildContext context, AuthApi api) => showModalBottomSheet<Map<String, dynamic>>(
  context: context,
  isScrollControlled: true,
  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
  builder: (_) => CreatePatientSheet(api: api),
);

class CreatePatientSheet extends StatefulWidget {
  const CreatePatientSheet({super.key, required this.api});

  final AuthApi api;

  @override
  State<CreatePatientSheet> createState() => _CreatePatientSheetState();
}

class _CreatePatientSheetState extends State<CreatePatientSheet> {
  final _formKey = GlobalKey<FormState>();
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final documentNumber = TextEditingController();
  final phone = TextEditingController();
  final email = TextEditingController();
  final address = TextEditingController();
  String documentType = 'CI';
  String? gender;
  DateTime? birthDate;
  bool saving = false;
  String? error;

  @override
  void dispose() {
    for (final controller in [firstName, lastName, documentNumber, phone, email, address]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final created = await widget.api.clinical.createPatient({
        'documentType': documentType,
        'documentNumber': documentNumber.text,
        'firstName': firstName.text,
        'lastName': lastName.text,
        'birthDate': isoDate(birthDate),
        'gender': gender,
        'phone': phone.text,
        'email': email.text,
        'address': address.text,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Paciente registrado.'))));
      Navigator.of(context).pop(created);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? tr('Campo obligatorio') : null;

  String? _email(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text) ? null : tr('Correo no válido');
  }

  Widget _text(TextEditingController controller, String label, int max, {Key? key, String? Function(String?)? validator, TextInputType? keyboard}) =>
      TextFormField(
        key: key,
        controller: controller,
        enabled: !saving,
        maxLength: max,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label, counterText: ''),
        validator: validator,
      );

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
            Text(context.tr('Nuevo paciente'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink)),
            const SizedBox(height: 16),
            _text(firstName, '${context.tr('Nombres')} *', 100, key: const Key('patient-first-name'), validator: _required),
            const SizedBox(height: 12),
            _text(lastName, '${context.tr('Apellidos')} *', 100, key: const Key('patient-last-name'), validator: _required),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: DropdownButtonFormField<String>(
                    initialValue: documentType,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: context.tr('Documento')),
                    items: [for (final type in patientDocumentTypes) DropdownMenuItem(value: type, child: Text(patientDocumentTypeLabel(type), overflow: TextOverflow.ellipsis))],
                    onChanged: saving ? null : (value) => setState(() => documentType = value ?? 'CI'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(flex: 3, child: _text(documentNumber, '${context.tr('Número')} *', 40, key: const Key('patient-document'), validator: _required)),
              ],
            ),
            const SizedBox(height: 12),
            DateField(label: context.tr('Fecha de nacimiento'), value: birthDate, enabled: !saving, onChanged: (value) => setState(() => birthDate = value)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: gender,
              decoration: InputDecoration(labelText: context.tr('Género')),
              items: [
                DropdownMenuItem<String>(value: null, child: Text(context.tr('Sin especificar'))),
                for (final value in patientGenders) DropdownMenuItem(value: value, child: Text(genderLabel(value))),
              ],
              onChanged: saving ? null : (value) => setState(() => gender = value),
            ),
            const SizedBox(height: 12),
            _text(phone, context.tr('Teléfono'), 30, keyboard: TextInputType.phone),
            const SizedBox(height: 12),
            _text(email, context.tr('Correo electrónico'), 150, keyboard: TextInputType.emailAddress, validator: _email),
            const SizedBox(height: 12),
            _text(address, context.tr('Dirección'), 255),
            const SizedBox(height: 12),
            if (error != null) ...[
              Text(error!, key: const Key('patient-error'), style: TextStyle(color: Colors.red.shade700)),
              const SizedBox(height: 8),
            ],
            FilledButton.icon(
              key: const Key('patient-save'),
              onPressed: saving ? null : save,
              style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
              icon: saving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.person_add_alt_1_outlined),
              label: Text(saving ? context.tr('Guardando…') : context.tr('Registrar paciente')),
            ),
          ],
        ),
      ),
    ),
  );
}
