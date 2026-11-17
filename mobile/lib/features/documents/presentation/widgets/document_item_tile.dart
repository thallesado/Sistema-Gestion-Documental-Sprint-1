import 'package:flutter/material.dart';

import '../../../../core/i18n/app_language.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/format.dart';
import '../../../../core/widgets/state_views.dart';

/// Fila de un documento en el repositorio y en los documentos recientes del inicio.
/// Recibe los datos de `GET /documents` y delega la acción de abrir y de descargar al padre.
class DocumentItemTile extends StatelessWidget {
  const DocumentItemTile({
    super.key,
    required this.doc,
    required this.onTap,
    this.downloading = false,
    this.onDownload,
  });

  final Map<String, dynamic> doc;
  final VoidCallback onTap;
  final bool downloading;

  /// `null` deshabilita la descarga (por ejemplo mientras otra descarga está en curso).
  final VoidCallback? onDownload;

  @override
  Widget build(BuildContext context) {
    final status = doc['status'] as String?;
    final subtitle = [doc['code'], doc['documentTypeName'], 'v${doc['currentVersion'] ?? 1}'].whereType<Object>().join(' · ');

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: AppTheme.teal.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.description_outlined, color: AppTheme.teal),
        ),
        title: Text(
          doc['name'] as String? ?? tr('Documento'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            StatusBadge(documentStatusLabel(status), tone: documentStatusTone(status)),
            const SizedBox(width: 4),
            downloading
                ? const Padding(
                    padding: EdgeInsets.all(8),
                    child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal)),
                  )
                : IconButton(
                    key: Key('download-doc-${doc['id']}'),
                    icon: const Icon(Icons.download_outlined, color: AppTheme.teal, size: 22),
                    tooltip: tr('Descargar archivo'),
                    onPressed: onDownload,
                  ),
          ],
        ),
      ),
    );
  }
}
