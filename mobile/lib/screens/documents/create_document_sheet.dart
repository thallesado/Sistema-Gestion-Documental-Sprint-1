import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/upload_rules.dart';
import 'upload_version_sheet.dart';

/// Abre la hoja para radicar / crear un nuevo documento.
Future<bool> showCreateDocumentSheet(BuildContext context, AuthApi api, {UploadPicker picker = pickWithDevice}) async =>
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => CreateDocumentSheet(api: api, picker: picker),
    ) ??
    false;

/// Hoja modal para crear un documento nuevo con archivo inicial.
/// Cumple con Principio de Responsabilidad Única (SRP): formulario, validación y envío.
class CreateDocumentSheet extends StatefulWidget {
  const CreateDocumentSheet({super.key, required this.api, this.picker = pickWithDevice});

  final AuthApi api;
  final UploadPicker picker;

  @override
  State<CreateDocumentSheet> createState() => _CreateDocumentSheetState();
}

class _CreateDocumentSheetState extends State<CreateDocumentSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();

  List<Map<String, dynamic>> _documentTypes = [];
  String? _selectedTypeId;
  PickedUpload? _picked;
  String? _error;
  bool _loadingTypes = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadDocumentTypes();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadDocumentTypes() async {
    try {
      final types = await widget.api.documents.documentTypes();
      if (!mounted) return;
      setState(() {
        _documentTypes = types;
        if (types.isNotEmpty) {
          _selectedTypeId = types.first['id'] as String?;
        }
        _loadingTypes = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingTypes = false);
    }
  }

  Future<void> _choose(UploadOrigin origin) async {
    setState(() => _error = null);
    try {
      final file = await widget.picker(origin);
      if (file == null || !mounted) return;
      if (file.sizeBytes > UploadRules.maxBytes) {
        setState(() => _error = 'El archivo supera el límite permitido de 25 MB.');
        return;
      }
      final mime = UploadRules.mimeFor(file.name);
      if (mime == null) {
        setState(() => _error = 'Formato no permitido. Usa PDF, JPG, PNG o DOCX.');
        return;
      }
      setState(() {
        _picked = file;
        // Si el nombre del documento aún está vacío, sugerir el nombre del archivo
        if (_nameController.text.trim().isEmpty) {
          final clean = file.name.replaceAll(RegExp(r'\.[a-zA-Z0-9]+$'), '').replaceAll('_', ' ');
          _nameController.text = clean;
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = 'No se pudo seleccionar el archivo: $e');
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedTypeId == null) {
      setState(() => _error = 'Selecciona un tipo documental.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final doc = await widget.api.documents.createDocument(
        name: _nameController.text.trim(),
        documentTypeId: _selectedTypeId!,
        description: _descriptionController.text.trim(),
      );

      final docId = doc['id'] as String?;
      if (docId != null && _picked != null) {
        await widget.api.documents.uploadVersion(
          docId,
          filePath: _picked!.path,
          fileName: _picked!.name,
          reason: 'Versión inicial cargada desde móvil',
        );
      }

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Error al crear documento: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottomInset + 20),
      child: Form(
        key: _formKey,
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
                  const Icon(Icons.note_add_outlined, color: AppTheme.teal),
                  const SizedBox(width: 8),
                  const Text('Nuevo documento / trámite', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(_error!, style: TextStyle(color: Colors.red.shade800, fontSize: 13)),
                ),
              TextFormField(
                key: const Key('create-doc-name'),
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Título o nombre del documento *',
                  hintText: 'Ej. Solicitud de permiso, Certificado...',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.title),
                ),
                validator: (val) => (val == null || val.trim().isEmpty) ? 'El título es obligatorio' : null,
              ),
              const SizedBox(height: 12),
              if (_loadingTypes)
                const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(color: AppTheme.teal)))
              else if (_documentTypes.isNotEmpty)
                DropdownButtonFormField<String>(
                  key: const Key('create-doc-type'),
                  initialValue: _selectedTypeId,
                  decoration: const InputDecoration(
                    labelText: 'Tipo documental *',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: [
                    for (final t in _documentTypes)
                      DropdownMenuItem<String>(
                        value: t['id'] as String?,
                        child: Text(t['name'] as String? ?? 'Tipo documental'),
                      ),
                  ],
                  onChanged: (val) => setState(() => _selectedTypeId = val),
                  validator: (val) => val == null ? 'Selecciona un tipo documental' : null,
                ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('create-doc-description'),
                controller: _descriptionController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Descripción / motivo (opcional)',
                  hintText: 'Detalle o notas adicionales...',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.description_outlined),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Archivo o fotografía (opcional)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              const SizedBox(height: 8),
              if (_picked != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.mint.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.teal.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(_picked!.isImage ? Icons.image : Icons.insert_drive_file, color: AppTheme.teal),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_picked!.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), overflow: TextOverflow.ellipsis),
                            Text(formatBytes(_picked!.sizeBytes), style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 20),
                        onPressed: () => setState(() => _picked = null),
                        tooltip: 'Quitar archivo',
                      ),
                    ],
                  ),
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('create-pick-camera'),
                        icon: const Icon(Icons.camera_alt, size: 18),
                        label: const Text('Cámara'),
                        onPressed: _submitting ? null : () => _choose(UploadOrigin.camera),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('create-pick-gallery'),
                        icon: const Icon(Icons.photo_library, size: 18),
                        label: const Text('Galería'),
                        onPressed: _submitting ? null : () => _choose(UploadOrigin.gallery),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('create-pick-file'),
                        icon: const Icon(Icons.attach_file, size: 18),
                        label: const Text('Archivo'),
                        onPressed: _submitting ? null : () => _choose(UploadOrigin.file),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 20),
              FilledButton.icon(
                key: const Key('create-doc-submit'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.teal,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.check),
                label: Text(
                  _submitting ? 'Creando...' : 'Crear y registrar documento',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
