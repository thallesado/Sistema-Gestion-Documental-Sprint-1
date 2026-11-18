import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/form_fields.dart';
import 'clinical_labels.dart';

/// Fila editable de una lista (alergias, medicación, diagnósticos).
class _Row {
  _Row(List<String> values, {this.option}) : controllers = [for (final value in values) TextEditingController(text: value)];

  final List<TextEditingController> controllers;

  /// Severidad de la alergia.
  String? option;

  String text(int index) => controllers[index].text.trim();

  void dispose() {
    for (final controller in controllers) {
      controller.dispose();
    }
  }
}

/// Apertura o edición de la historia clínica (anamnesis, antecedentes, alergias,
/// medicación y diagnósticos base), con el contrato `ClinicalHistoryRequest` de la web.
/// Devuelve la historia guardada.
class ClinicalHistoryFormPage extends StatefulWidget {
  const ClinicalHistoryFormPage({super.key, required this.api, required this.patientId, this.history});

  final AuthApi api;
  final String patientId;

  /// `null` abre una historia nueva.
  final Map<String, dynamic>? history;

  @override
  State<ClinicalHistoryFormPage> createState() => _ClinicalHistoryFormPageState();
}

class _ClinicalHistoryFormPageState extends State<ClinicalHistoryFormPage> {
  final _formKey = GlobalKey<FormState>();
  late final pathological = TextEditingController(text: _initial('pathologicalAntecedents'));
  late final nonPathological = TextEditingController(text: _initial('nonPathologicalAntecedents'));
  late final family = TextEditingController(text: _initial('familyAntecedents'));
  late final chronic = TextEditingController(text: _initial('chronicConditions'));
  late final observations = TextEditingController(text: _initial('observations'));
  String? bloodType;
  final allergies = <_Row>[];
  final medications = <_Row>[];
  final diagnoses = <_Row>[];
  bool saving = false;
  String? error;

  bool get isNew => widget.history == null;

  String _initial(String key) => widget.history?[key] as String? ?? '';

  List<Map<String, dynamic>> _list(String key) =>
      ((widget.history?[key] as List<dynamic>?) ?? const []).whereType<Map<String, dynamic>>().toList();

  @override
  void initState() {
    super.initState();
    final blood = widget.history?['bloodType'] as String?;
    bloodType = bloodTypes.contains(blood) ? blood : null;
    for (final a in _list('allergies')) {
      allergies.add(_Row([a['allergen'] as String? ?? '', a['reaction'] as String? ?? ''], option: a['severity'] as String? ?? 'LOW'));
    }
    for (final m in _list('currentMedications')) {
      medications.add(_Row([m['name'] as String? ?? '', m['dose'] as String? ?? '', m['frequency'] as String? ?? '']));
    }
    for (final d in _list('baseDiagnoses')) {
      diagnoses.add(_Row([d['code'] as String? ?? '', d['description'] as String? ?? '', d['diagnosedAt'] as String? ?? '']));
    }
  }

  @override
  void dispose() {
    for (final controller in [pathological, nonPathological, family, chronic, observations]) {
      controller.dispose();
    }
    for (final row in [...allergies, ...medications, ...diagnoses]) {
      row.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _payload() => {
    'bloodType': bloodType,
    'pathologicalAntecedents': pathological.text.trim(),
    'nonPathologicalAntecedents': nonPathological.text.trim(),
    'familyAntecedents': family.text.trim(),
    'chronicConditions': chronic.text.trim(),
    'observations': observations.text.trim(),
    'allergies': [
      for (final row in allergies)
        if (row.text(0).isNotEmpty) {'allergen': row.text(0), 'severity': row.option ?? 'LOW', 'reaction': row.text(1)},
    ],
    'currentMedications': [
      for (final row in medications)
        if (row.text(0).isNotEmpty) {'name': row.text(0), 'dose': row.text(1), 'frequency': row.text(2)},
    ],
    'baseDiagnoses': [
      for (final row in diagnoses)
        if (row.text(1).isNotEmpty) {'code': row.text(0), 'description': row.text(1), 'diagnosedAt': row.text(2)},
    ],
  };

  Future<void> save() async {
    setState(() => error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => saving = true);
    try {
      final clinical = widget.api.clinical;
      final saved = isNew
          ? await clinical.createHistory(widget.patientId, _payload())
          : await clinical.updateHistory(widget.history!['id'] as String, widget.patientId, _payload());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(isNew
            ? tr('Historia clínica {code} abierta.', {'code': saved['code'] ?? ''})
            : tr('Historia clínica actualizada. Se registró la revisión.')),
      ));
      Navigator.of(context).pop(saved);
    } on ApiException catch (exception) {
      if (mounted) {
        setState(() => error = exception.statusCode == 409
            ? tr('Otra persona modificó esta historia. Vuelve a abrirla para ver los cambios.')
            : exception.message);
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget _area(TextEditingController controller, String label, {int max = 4000, Key? key}) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: TextFormField(
      key: key,
      controller: controller,
      enabled: !saving,
      minLines: 2,
      maxLines: 5,
      maxLength: max,
      decoration: InputDecoration(labelText: label, alignLabelWithHint: true),
    ),
  );

  Widget _listSection({
    required String title,
    required IconData icon,
    required List<_Row> rows,
    required String addLabel,
    required String keyPrefix,
    required _Row Function() create,
    required Widget Function(_Row row) builder,
  }) => SectionCard(
    title: title,
    icon: icon,
    trailing: TextButton.icon(
      key: Key('$keyPrefix-add'),
      onPressed: saving ? null : () => setState(() => rows.add(create())),
      icon: const Icon(Icons.add, size: 18),
      label: Text(addLabel),
    ),
    children: [
      if (rows.isEmpty) Text(context.tr('Sin registros.'), style: TextStyle(color: Colors.grey.shade600)),
      for (final row in rows)
        Container(
          key: ObjectKey(row),
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(12, 12, 4, 4),
          decoration: BoxDecoration(color: AppTheme.canvas, borderRadius: BorderRadius.circular(10)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: builder(row)),
              IconButton(
                tooltip: context.tr('Quitar'),
                icon: Icon(Icons.delete_outline, color: Colors.red.shade400),
                onPressed: saving
                    ? null
                    : () => setState(() {
                        rows.remove(row);
                        row.dispose();
                      }),
              ),
            ],
          ),
        ),
    ],
  );

  Widget _field(TextEditingController controller, String label, int max, {String? Function(String?)? validator}) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: TextFormField(
      controller: controller,
      enabled: !saving,
      maxLength: max,
      decoration: InputDecoration(labelText: label, isDense: true, counterText: ''),
      validator: validator,
    ),
  );

  String? _required(String? value) => value == null || value.trim().isEmpty ? tr('Campo obligatorio') : null;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(isNew ? context.tr('Abrir historia clínica') : context.tr('Editar historia clínica'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      backgroundColor: Colors.white,
    ),
    body: Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: context.tr('Datos generales'),
            icon: Icons.bloodtype_outlined,
            children: [
              DropdownButtonFormField<String>(
                key: const Key('history-blood'),
                isExpanded: true,
                initialValue: bloodType,
                decoration: InputDecoration(labelText: context.tr('Grupo sanguíneo y factor Rh')),
                items: [
                  DropdownMenuItem<String>(value: null, child: Text(context.tr('No especificado'))),
                  for (final type in bloodTypes) DropdownMenuItem(value: type, child: Text(type)),
                ],
                onChanged: saving ? null : (value) => setState(() => bloodType = value),
              ),
              const SizedBox(height: 12),
              _area(chronic, context.tr('Condiciones crónicas'), max: 2000),
            ],
          ),
          SectionCard(
            title: context.tr('Antecedentes'),
            icon: Icons.history_edu_outlined,
            children: [
              _area(pathological, context.tr('Antecedentes patológicos'), key: const Key('history-pathological')),
              _area(nonPathological, context.tr('Antecedentes no patológicos')),
              _area(family, context.tr('Antecedentes familiares')),
            ],
          ),
          _listSection(
            title: context.tr('Alergias'),
            icon: Icons.warning_amber_outlined,
            rows: allergies,
            addLabel: context.tr('Agregar'),
            keyPrefix: 'allergy',
            create: () => _Row(['', ''], option: 'LOW'),
            builder: (row) => Column(
              children: [
                _field(row.controllers[0], '${context.tr('Alérgeno')} *', 255, validator: _required),
                DropdownButtonFormField<String>(
                  initialValue: row.option,
                  isExpanded: true,
                  isDense: true,
                  decoration: InputDecoration(labelText: context.tr('Severidad'), isDense: true),
                  items: [for (final severity in allergySeverities) DropdownMenuItem(value: severity, child: Text(severityLabel(severity)))],
                  onChanged: saving ? null : (value) => setState(() => row.option = value),
                ),
                const SizedBox(height: 8),
                _field(row.controllers[1], context.tr('Reacción'), 255),
              ],
            ),
          ),
          _listSection(
            title: context.tr('Medicación actual'),
            icon: Icons.medication_outlined,
            rows: medications,
            addLabel: context.tr('Agregar'),
            keyPrefix: 'medication',
            create: () => _Row(['', '', '']),
            builder: (row) => Column(
              children: [
                _field(row.controllers[0], '${context.tr('Medicamento')} *', 255, validator: _required),
                _field(row.controllers[1], context.tr('Dosis'), 120),
                _field(row.controllers[2], context.tr('Frecuencia'), 120),
              ],
            ),
          ),
          _listSection(
            title: context.tr('Diagnósticos base'),
            icon: Icons.assignment_outlined,
            rows: diagnoses,
            addLabel: context.tr('Agregar'),
            keyPrefix: 'diagnosis',
            create: () => _Row(['', '', '']),
            builder: (row) => Column(
              children: [
                _field(row.controllers[0], context.tr('Código (CIE-10)'), 40),
                _field(row.controllers[1], '${context.tr('Descripción')} *', 500, validator: _required),
                _field(row.controllers[2], context.tr('Fecha de diagnóstico'), 40),
              ],
            ),
          ),
          SectionCard(
            title: context.tr('Observaciones'),
            icon: Icons.notes_outlined,
            children: [_area(observations, context.tr('Observaciones generales'))],
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(error!, key: const Key('history-error'), style: TextStyle(color: Colors.red.shade700)),
            ),
          FilledButton.icon(
            key: const Key('history-save'),
            onPressed: saving ? null : save,
            style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
            icon: saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save_outlined),
            label: Text(saving ? context.tr('Guardando…') : isNew ? context.tr('Abrir historia clínica') : context.tr('Guardar cambios')),
          ),
          const SizedBox(height: 24),
        ],
      ),
    ),
  );
}
