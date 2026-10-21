import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/upload_rules.dart';

/// Origen del archivo de la nueva versión.
enum UploadOrigin { camera, gallery, file }

/// Archivo elegido en el teléfono, listo para enviar.
class PickedUpload {
  const PickedUpload({required this.path, required this.name, required this.sizeBytes, this.isImage = false});

  final String path;
  final String name;
  final int sizeBytes;
  final bool isImage;
}

typedef UploadPicker = Future<PickedUpload?> Function(UploadOrigin origin);

/// Selector real: cámara y galería con image_picker (JPEG comprimido) y documentos con file_selector.
Future<PickedUpload?> pickWithDevice(UploadOrigin origin) async {
  if (origin == UploadOrigin.file) {
    final file = await openFile(acceptedTypeGroups: [
      XTypeGroup(label: 'Documentos', extensions: UploadRules.allowedExtensions, mimeTypes: UploadRules.allowedMimeTypes),
    ]);
    if (file == null) return null;
    return PickedUpload(path: file.path, name: file.name, sizeBytes: await file.length());
  }
  final image = await ImagePicker().pickImage(
    source: origin == UploadOrigin.camera ? ImageSource.camera : ImageSource.gallery,
    imageQuality: 85,
    maxWidth: 2400,
    maxHeight: 2400,
  );
  if (image == null) return null;
  final stamp = DateTime.now().toIso8601String().replaceAll(RegExp(r'[^0-9]'), '').substring(0, 14);
  final extension = image.name.contains('.') ? image.name.split('.').last.toLowerCase() : 'jpg';
  final name = origin == UploadOrigin.camera ? 'foto_$stamp.jpg' : 'imagen_$stamp.$extension';
  return PickedUpload(path: image.path, name: name, sizeBytes: await image.length(), isImage: true);
}

/// Abre la hoja de subida. Devuelve `true` si se creó una versión.
Future<bool> showUploadVersionSheet(BuildContext context, AuthApi api, String documentId, {UploadPicker picker = pickWithDevice}) async =>
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => UploadVersionSheet(api: api, documentId: documentId, picker: picker),
    ) ??
    false;

class UploadVersionSheet extends StatefulWidget {
  const UploadVersionSheet({super.key, required this.api, required this.documentId, this.picker = pickWithDevice});

  final AuthApi api;
  final String documentId;
  final UploadPicker picker;

  @override
  State<UploadVersionSheet> createState() => _UploadVersionSheetState();
}

class _UploadVersionSheetState extends State<UploadVersionSheet> {
  final reason = TextEditingController();
  PickedUpload? picked;
  String? error;
  bool uploading = false;

  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  Future<void> pick(UploadOrigin origin) async {
    setState(() => error = null);
    try {
      final file = await widget.picker(origin);
      if (file != null && mounted) setState(() => picked = file);
    } catch (_) {
      if (mounted) {
        setState(
          () => error = origin == UploadOrigin.camera
              ? 'No se pudo abrir la cámara. Revisa el permiso de cámara de NexoDocs.'
              : 'No se pudo leer el archivo seleccionado.',
        );
      }
    }
  }

  Future<void> upload() async {
    final file = picked;
    if (file == null) {
      setState(() => error = 'Toma una foto o elige un archivo.');
      return;
    }
    final invalid = UploadRules.validate(fileName: file.name, sizeBytes: file.sizeBytes, reason: reason.text);
    if (invalid != null) {
      setState(() => error = invalid);
      return;
    }
    setState(() {
      uploading = true;
      error = null;
    });
    try {
      final version = await widget.api.documents.uploadVersion(
        widget.documentId,
        filePath: file.path,
        fileName: file.name,
        reason: reason.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Versión v${version['versionNumber'] ?? ''} subida correctamente.')));
      Navigator.of(context).pop(true);
    } on ApiException catch (exception) {
      if (mounted) {
        setState(() => error = exception.isForbidden ? 'Tu perfil no puede subir versiones de este documento.' : exception.message);
      }
    } finally {
      if (mounted) setState(() => uploading = false);
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
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Subir nueva versión',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
          ),
          const SizedBox(height: 4),
          Text(
            'PDF, JPG, PNG o DOCX hasta 25 MB. El servidor registra la huella SHA-256.',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _originButton(UploadOrigin.camera, Icons.photo_camera_outlined, 'Cámara')),
              const SizedBox(width: 8),
              Expanded(child: _originButton(UploadOrigin.gallery, Icons.photo_library_outlined, 'Galería')),
              const SizedBox(width: 8),
              Expanded(child: _originButton(UploadOrigin.file, Icons.attach_file, 'Archivo')),
            ],
          ),
          if (picked != null) ...[
            const SizedBox(height: 14),
            Container(
              key: const Key('picked-file'),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppTheme.mint.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: picked!.isImage
                        ? Image.file(
                            File(picked!.path),
                            width: 48,
                            height: 48,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const _FileIcon(),
                          )
                        : const _FileIcon(),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          picked!.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(formatBytes(picked!.sizeBytes), style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Quitar archivo',
                    icon: const Icon(Icons.close),
                    onPressed: uploading ? null : () => setState(() => picked = null),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          TextField(
            key: const Key('version-reason'),
            controller: reason,
            enabled: !uploading,
            maxLength: UploadRules.maxReasonLength,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Motivo de la nueva versión *', border: OutlineInputBorder()),
          ),
          if (error != null) ...[
            Text(
              error!,
              key: const Key('upload-error'),
              style: TextStyle(color: Colors.red.shade700),
            ),
            const SizedBox(height: 8),
          ],
          FilledButton.icon(
            key: const Key('upload-submit'),
            onPressed: uploading ? null : upload,
            style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
            icon: uploading
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.cloud_upload_outlined),
            label: Text(uploading ? 'Subiendo…' : 'Subir versión'),
          ),
        ],
      ),
    ),
  );

  Widget _originButton(UploadOrigin origin, IconData icon, String label) => OutlinedButton(
    key: Key('origin-${origin.name}'),
    onPressed: uploading ? null : () => pick(origin),
    style: OutlinedButton.styleFrom(
      foregroundColor: AppTheme.teal,
      padding: const EdgeInsets.symmetric(vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    ),
  );
}

class _FileIcon extends StatelessWidget {
  const _FileIcon();

  @override
  Widget build(BuildContext context) => Container(
    width: 48,
    height: 48,
    color: Colors.white,
    child: const Icon(Icons.insert_drive_file_outlined, color: AppTheme.teal),
  );
}
