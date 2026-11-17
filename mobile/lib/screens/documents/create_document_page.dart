import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/api/component_permissions_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/upload_rules.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/state_views.dart';
import 'upload_version_sheet.dart';

/// Alta manual de un documento, como "Nuevo documento" de la web: clasificación,
/// metadatos y, si se adjunta, el archivo inicial como versión v1.
///
/// Respeta los privilegios por componente del formulario `documento.nuevo`: los campos
/// ocultos no se muestran y los de solo lectura no se envían (el servidor asigna el valor).
/// Devuelve el documento creado al cerrar.
class CreateDocumentPage extends StatefulWidget {
  const CreateDocumentPage({
    super.key,
    required this.api,
    this.picker = pickWithDevice,
    this.initialExpedient,
    this.initialPatient,
  });

  final AuthApi api;
  final UploadPicker picker;

  /// Expediente o paciente ya elegidos al abrir el formulario desde su ficha.
  final PickerOption? initialExpedient;
  final PickerOption? initialPatient;

  static const form = 'documento.nuevo';
  static const initialVersionReason = 'Carga inicial (versión v1)';

  @override
  State<CreateDocumentPage> createState() => _CreateDocumentPageState();
}

class _CreateDocumentPageState extends State<CreateDocumentPage> {
  final _formKey = GlobalKey<FormState>();
  final name = TextEditingController();
  final code = TextEditingController();
  final description = TextEditingController();

  FormAccess access = FormAccess.open;
  List<Map<String, dynamic>> types = [];
  List<Map<String, dynamic>> departments = [];
  List<String> specialties = [];
  List<String> processes = [];

  String? typeId;
  String? departmentId;
  String? specialty;
  String? process;
  PickerOption? patient;
  PickerOption? expedient;
  DateTime? issueDate;
  DateTime? expiryDate;
  PickedUpload? file;

  bool loading = true;
  bool saving = false;
  String? loadError;
  String? error;

  UserPermissions get permissions => widget.api.permissions.value;

  @override
  void initState() {
    super.initState();
    patient = widget.initialPatient;
    expedient = widget.initialExpedient;
    load();
  }

  @override
  void dispose() {
    name.dispose();
    code.dispose();
    description.dispose();
    super.dispose();
  }

  /// Catálogos del formulario. Solo los tipos documentales son imprescindibles;
  /// el resto se deja vacío si el perfil no puede consultarlos.
  Future<void> load() async {
    setState(() {
      loading = true;
      loadError = null;
    });
    try {
      final docs = widget.api.documents;
      final results = await Future.wait<Object?>([
        widget.api.componentPermissions.form(CreateDocumentPage.form),
        docs.types(),
        _optional(docs.departments, <Map<String, dynamic>>[]),
        _optional(docs.specialties, <String>[]),
        _optional(docs.processes, <String>[]),
      ]);
      if (widget.api.currentUser == null) await widget.api.loadPermissions();
      final allowed = widget.api.allowedDocumentTypeIds;
      final allTypes = results[1] as List<Map<String, dynamic>>;
      if (!mounted) return;
      setState(() {
        access = results[0] as FormAccess;
        types = allowed.isEmpty ? allTypes : allTypes.where((type) => allowed.contains(type['id'])).toList();
        departments = results[2] as List<Map<String, dynamic>>;
        specialties = results[3] as List<String>;
        processes = results[4] as List<String>;
        if (types.length == 1) typeId = types.first['id'] as String?;
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => loadError = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  static Future<T> _optional<T>(Future<T> Function() request, T fallback) async {
    try {
      return await request();
    } on SessionExpiredException {
      rethrow;
    } on ApiException {
      return fallback;
    }
  }

  bool _editable(String component) => access.editable(component);
  bool _visible(String component) => access.visible(component);

  Future<void> pickFile(UploadOrigin origin) async {
    setState(() => error = null);
    try {
      final picked = await widget.picker(origin);
      if (picked == null || !mounted) return;
      final invalid = UploadRules.validate(fileName: picked.name, sizeBytes: picked.sizeBytes, reason: CreateDocumentPage.initialVersionReason);
      setState(() {
        file = invalid == null ? picked : null;
        error = invalid == null ? null : tr(invalid);
      });
    } catch (_) {
      if (mounted) {
        setState(() => error = origin == UploadOrigin.camera
            ? tr('No se pudo abrir la cámara. Revisa el permiso de cámara de NexoDocs.')
            : tr('No se pudo leer el archivo seleccionado.'));
      }
    }
  }

  Map<String, dynamic> _payload() {
    final payload = <String, dynamic>{'documentTypeId': typeId};
    void put(String component, String key, Object? value) {
      if (_editable(component) && value != null) payload[key] = value;
    }

    put('nombre', 'name', name.text);
    put('codigo', 'code', code.text);
    put('descripcion', 'description', description.text);
    put('departamento', 'departmentId', departmentId);
    put('especialidad', 'specialty', specialty);
    put('proceso', 'institutionalProcess', process);
    put('paciente', 'patientId', patient?.id);
    put('expediente', 'expedientId', expedient?.id);
    put('emision', 'issueDate', isoDate(issueDate));
    put('vencimiento', 'expiryDate', isoDate(expiryDate));
    return payload;
  }

  Future<void> submit() async {
    setState(() => error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (typeId == null) {
      setState(() => error = tr('Selecciona el tipo documental.'));
      return;
    }
    if (issueDate != null && expiryDate != null && expiryDate!.isBefore(issueDate!)) {
      setState(() => error = tr('La fecha de vencimiento no puede ser anterior a la de emisión.'));
      return;
    }
    setState(() => saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final created = await widget.api.documents.create(_payload());
      var message = tr('Documento {code} registrado con éxito.', {'code': created['code'] ?? ''});
      final picked = file;
      if (picked != null) {
        try {
          await widget.api.documents.uploadVersion(
            created['id'] as String,
            filePath: picked.path,
            fileName: picked.name,
            reason: CreateDocumentPage.initialVersionReason,
          );
          created['currentVersion'] = 1;
          message = tr('Documento {code} y versión inicial v1 almacenados con éxito.', {'code': created['code'] ?? ''});
        } on SessionExpiredException {
          rethrow;
        } on ApiException {
          message = tr('Documento {code} creado. Puedes subir la versión desde el detalle.', {'code': created['code'] ?? ''});
        }
      }
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(message)));
      Navigator.of(context).pop(created);
    } on ApiException catch (exception) {
      if (mounted) {
        setState(() => error = exception.isForbidden
            ? tr('Tu perfil no puede crear documentos de este tipo.')
            : exception.message);
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<List<PickerOption>> _searchPatients(String query) async => [
    for (final p in await widget.api.clinical.patients(query))
      PickerOption(
        p['id'] as String,
        '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim(),
        subtitle: '${p['documentType'] ?? 'CI'}: ${p['documentNumber'] ?? ''}',
      ),
  ];

  Future<List<PickerOption>> _searchExpedients(String query) async => [
    for (final e in await widget.api.expedients.list(filter: query, status: 'ACTIVE', size: 30))
      PickerOption(e['id'] as String, '${e['code'] ?? ''} · ${e['name'] ?? ''}', subtitle: e['description'] as String?),
  ];

  String? _required(String? value, String component) =>
      _editable(component) && (value == null || value.trim().isEmpty) ? tr('Campo obligatorio') : null;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(context.tr('Nuevo documento'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      backgroundColor: Colors.white,
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
        : loadError != null
        ? ErrorStateView(message: loadError!, onRetry: load)
        : Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  context.tr('Registra la clasificación documental y los metadatos. El documento queda en Borrador dentro de tu organización.'),
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: context.tr('Identificación'),
                  icon: Icons.badge_outlined,
                  children: [
                    if (_visible('nombre')) ...[
                      TextFormField(
                        key: const Key('doc-name'),
                        controller: name,
                        enabled: _editable('nombre') && !saving,
                        maxLength: 255,
                        decoration: InputDecoration(
                          labelText: _editable('nombre') ? '${context.tr('Nombre del documento')} *' : context.tr('Nombre del documento (lo asigna el sistema)'),
                        ),
                        validator: (value) => _required(value, 'nombre'),
                      ),
                      const SizedBox(height: 4),
                    ],
                    if (_visible('codigo')) ...[
                      TextFormField(
                        key: const Key('doc-code'),
                        controller: code,
                        enabled: _editable('codigo') && !saving,
                        maxLength: 60,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: _editable('codigo') ? '${context.tr('Código institucional')} *' : context.tr('Código institucional (lo asigna el sistema)'),
                          hintText: 'DOC-2026-001',
                        ),
                        validator: (value) => _required(value, 'codigo'),
                      ),
                      const SizedBox(height: 4),
                    ],
                    DropdownButtonFormField<String>(
                      key: const Key('doc-type'),
                      initialValue: typeId,
                      isExpanded: true,
                      decoration: InputDecoration(labelText: '${context.tr('Tipo documental')} *'),
                      items: [
                        for (final type in types)
                          DropdownMenuItem(value: type['id'] as String, child: Text('${type['name']} · ${type['code']}', overflow: TextOverflow.ellipsis)),
                      ],
                      onChanged: saving ? null : (value) => setState(() => typeId = value),
                      validator: (value) => value == null ? tr('Selecciona el tipo documental.') : null,
                    ),
                    if (types.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          context.tr('No hay tipos documentales disponibles para tu perfil.'),
                          style: TextStyle(fontSize: 12, color: Colors.orange.shade800),
                        ),
                      ),
                  ],
                ),
                SectionCard(
                  title: context.tr('Clasificación'),
                  icon: Icons.category_outlined,
                  children: [
                    if (_visible('departamento') && departments.isNotEmpty) ...[
                      DropdownButtonFormField<String>(
                        initialValue: departmentId,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: context.tr('Servicio / Departamento')),
                        items: [
                          DropdownMenuItem<String>(value: null, child: Text(context.tr('Sin departamento'))),
                          for (final dept in departments)
                            DropdownMenuItem(value: dept['id'] as String, child: Text('${dept['name']} (${dept['code'] ?? ''})', overflow: TextOverflow.ellipsis)),
                        ],
                        onChanged: _editable('departamento') && !saving ? (value) => setState(() => departmentId = value) : null,
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_visible('especialidad') && specialties.isNotEmpty) ...[
                      _stringDropdown(context.tr('Especialidad'), specialty, specialties, 'especialidad', (v) => specialty = v),
                      const SizedBox(height: 12),
                    ],
                    if (_visible('proceso') && processes.isNotEmpty) ...[
                      _stringDropdown(context.tr('Proceso institucional'), process, processes, 'proceso', (v) => process = v),
                      const SizedBox(height: 12),
                    ],
                    if (_visible('paciente') && permissions.canAny([Permissions.patientRead, Permissions.documentCreate])) ...[
                      SearchPickerField(
                        key: const Key('doc-patient'),
                        label: context.tr('Paciente asociado (si aplica)'),
                        value: patient,
                        icon: Icons.person_search_outlined,
                        enabled: _editable('paciente') && !saving,
                        search: _searchPatients,
                        onChanged: (value) => setState(() => patient = value),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_visible('expediente') && permissions.can(Permissions.expedientRead))
                      SearchPickerField(
                        key: const Key('doc-expedient'),
                        label: context.tr('Expediente vinculado (opcional)'),
                        value: expedient,
                        icon: Icons.folder_open_outlined,
                        enabled: _editable('expediente') && !saving,
                        search: _searchExpedients,
                        onChanged: (value) => setState(() => expedient = value),
                      ),
                  ],
                ),
                SectionCard(
                  title: context.tr('Vigencia y resumen'),
                  icon: Icons.event_outlined,
                  children: [
                    if (_visible('emision')) ...[
                      DateField(
                        label: context.tr('Fecha de emisión'),
                        value: issueDate,
                        enabled: _editable('emision') && !saving,
                        onChanged: (value) => setState(() => issueDate = value),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_visible('vencimiento')) ...[
                      DateField(
                        label: context.tr('Fecha de vencimiento'),
                        value: expiryDate,
                        enabled: _editable('vencimiento') && !saving,
                        onChanged: (value) => setState(() => expiryDate = value),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_visible('descripcion'))
                      TextFormField(
                        key: const Key('doc-description'),
                        controller: description,
                        enabled: _editable('descripcion') && !saving,
                        minLines: 3,
                        maxLines: 6,
                        maxLength: 10000,
                        decoration: InputDecoration(labelText: context.tr('Descripción / Resumen')),
                      ),
                  ],
                ),
                if (permissions.can(Permissions.documentUpdate))
                  SectionCard(
                    title: context.tr('Archivo inicial (opcional)'),
                    icon: Icons.attach_file,
                    children: [
                      Text(
                        context.tr('PDF, JPG, PNG o DOCX hasta 25 MB. Se guarda como versión v1 con su huella SHA-256.'),
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _originButton(UploadOrigin.camera, Icons.photo_camera_outlined, context.tr('Cámara'))),
                          const SizedBox(width: 8),
                          Expanded(child: _originButton(UploadOrigin.gallery, Icons.photo_library_outlined, context.tr('Galería'))),
                          const SizedBox(width: 8),
                          Expanded(child: _originButton(UploadOrigin.file, Icons.attach_file, context.tr('Archivo'))),
                        ],
                      ),
                      if (file != null) ...[
                        const SizedBox(height: 10),
                        ListTile(
                          key: const Key('doc-initial-file'),
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.insert_drive_file_outlined, color: AppTheme.teal),
                          title: Text(file!.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text(formatBytes(file!.sizeBytes)),
                          trailing: IconButton(
                            tooltip: context.tr('Quitar archivo'),
                            icon: const Icon(Icons.close),
                            onPressed: saving ? null : () => setState(() => file = null),
                          ),
                        ),
                      ],
                    ],
                  ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(error!, key: const Key('doc-create-error'), style: TextStyle(color: Colors.red.shade700)),
                  ),
                FilledButton.icon(
                  key: const Key('doc-create-submit'),
                  onPressed: saving || types.isEmpty ? null : submit,
                  style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
                  icon: saving
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.save_outlined),
                  label: Text(saving ? context.tr('Guardando…') : context.tr('Crear documento')),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
  );

  Widget _stringDropdown(String label, String? value, List<String> options, String component, void Function(String?) assign) =>
      DropdownButtonFormField<String>(
        initialValue: value,
        isExpanded: true,
        decoration: InputDecoration(labelText: label),
        items: [
          DropdownMenuItem<String>(value: null, child: Text(context.tr('Sin especificar'))),
          for (final option in options) DropdownMenuItem(value: option, child: Text(option, overflow: TextOverflow.ellipsis)),
        ],
        onChanged: _editable(component) && !saving ? (selected) => setState(() => assign(selected)) : null,
      );

  Widget _originButton(UploadOrigin origin, IconData icon, String label) => OutlinedButton(
    key: Key('doc-origin-${origin.name}'),
    onPressed: saving ? null : () => pickFile(origin),
    style: OutlinedButton.styleFrom(
      foregroundColor: AppTheme.teal,
      padding: const EdgeInsets.symmetric(vertical: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(icon), const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 12))]),
  );
}
