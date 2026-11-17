import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/form_fields.dart';
import '../../core/widgets/state_views.dart';
import '../documents/create_document_page.dart';
import '../documents/document_detail_sheet.dart';
import 'expedient_labels.dart';

/// Ficha de un expediente: datos, documentos vinculados y cambios de estado
/// (cerrar, archivar, reabrir), con los mismos endpoints que la web.
class ExpedientDetailPage extends StatefulWidget {
  const ExpedientDetailPage({super.key, required this.api, required this.expedientId});

  final AuthApi api;
  final String expedientId;

  @override
  State<ExpedientDetailPage> createState() => _ExpedientDetailPageState();
}

class _ExpedientDetailPageState extends State<ExpedientDetailPage> {
  Map<String, dynamic>? expedient;
  List<Map<String, dynamic>> documents = [];
  String? documentsError;
  String? error;
  bool loading = true;
  bool acting = false;

  UserPermissions get permissions => widget.api.permissions.value;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.expedients.detail(widget.expedientId);
      if (!mounted) return;
      setState(() => expedient = result);
      await _loadDocuments();
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _loadDocuments() async {
    if (!permissions.can(Permissions.documentRead)) return;
    try {
      final result = await widget.api.documents.byExpedient(widget.expedientId);
      if (mounted) {
        setState(() {
          documents = result;
          documentsError = null;
        });
      }
    } on SessionExpiredException {
      rethrow;
    } on ApiException catch (exception) {
      if (mounted) setState(() => documentsError = exception.message);
    }
  }

  Future<void> transition(String action, String confirmTitle, String confirmBody) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(confirmTitle),
        content: Text(confirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ctx.tr('Cancelar'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(ctx.tr('Confirmar'))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => acting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final updated = await widget.api.expedients.transition(widget.expedientId, action);
      if (!mounted) return;
      setState(() => expedient = updated);
      messenger.showSnackBar(SnackBar(content: Text(tr('Estado actualizado: {status}.', {'status': expedientStatusLabel(updated['status'] as String?)}))));
    } on ApiException catch (exception) {
      messenger.showSnackBar(SnackBar(content: Text(exception.message), backgroundColor: Colors.red.shade700));
    } finally {
      if (mounted) setState(() => acting = false);
    }
  }

  Future<void> newDocument() async {
    final item = expedient!;
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => CreateDocumentPage(
          api: widget.api,
          initialExpedient: PickerOption(item['id'] as String, '${item['code'] ?? ''} · ${item['name'] ?? ''}'),
        ),
      ),
    );
    if (created != null) await _loadDocuments();
  }

  List<Widget> _actions(String? status) {
    if (!permissions.can(Permissions.expedientUpdate)) return const [];
    return [
      if (status == 'ACTIVE')
        OutlinedButton.icon(
          key: const Key('expedient-close'),
          onPressed: acting ? null : () => transition('close', tr('Cerrar expediente'), tr('El expediente dejará de admitir cambios hasta que se reabra.')),
          icon: const Icon(Icons.lock_outline),
          label: Text(context.tr('Cerrar')),
        ),
      if (status == 'CLOSED')
        OutlinedButton.icon(
          key: const Key('expedient-archive'),
          onPressed: acting ? null : () => transition('archive', tr('Archivar expediente'), tr('El expediente pasará al archivo de la organización.')),
          icon: const Icon(Icons.archive_outlined),
          label: Text(context.tr('Archivar')),
        ),
      if (status == 'CLOSED' || status == 'ARCHIVED')
        OutlinedButton.icon(
          key: const Key('expedient-reopen'),
          onPressed: acting ? null : () => transition('reopen', tr('Reabrir expediente'), tr('El expediente volverá a estar activo.')),
          icon: const Icon(Icons.lock_open_outlined),
          label: Text(context.tr('Reabrir')),
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final item = expedient;
    final status = item?['status'] as String?;
    final actions = _actions(status);
    return Scaffold(
      appBar: AppBar(
        title: Text(item?['code'] as String? ?? context.tr('Expediente'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
      ),
      floatingActionButton: item != null && status == 'ACTIVE' && permissions.can(Permissions.documentCreate)
          ? FloatingActionButton.extended(
              key: const Key('expedient-new-document'),
              onPressed: newDocument,
              backgroundColor: AppTheme.teal,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.note_add_outlined),
              label: Text(context.tr('Nuevo documento')),
            )
          : null,
      body: loading && item == null
          ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
          : error != null && item == null
          ? ErrorStateView(message: error!, onRetry: load)
          : RefreshIndicator(
              onRefresh: load,
              color: AppTheme.teal,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                children: [
                  SectionCard(
                    title: item!['name'] as String? ?? '—',
                    icon: Icons.folder_outlined,
                    trailing: StatusBadge(expedientStatusLabel(status), tone: expedientStatusTone(status)),
                    children: [
                      InfoRow(context.tr('Código'), item['code']),
                      InfoRow(context.tr('Descripción'), item['description']),
                      InfoRow(context.tr('Creado'), formatDate(item['createdAt'], withTime: true)),
                      if (item['closedAt'] != null) InfoRow(context.tr('Cerrado'), formatDate(item['closedAt'], withTime: true)),
                      if (item['archivedAt'] != null) InfoRow(context.tr('Archivado'), formatDate(item['archivedAt'], withTime: true)),
                      if (actions.isNotEmpty) Wrap(spacing: 8, runSpacing: 8, children: actions),
                    ],
                  ),
                  if (permissions.can(Permissions.documentRead))
                    SectionCard(
                      title: context.tr('Documentos del expediente ({count})', {'count': documents.length}),
                      icon: Icons.description_outlined,
                      children: [
                        if (documentsError != null)
                          Text(documentsError!, style: TextStyle(color: Colors.red.shade700))
                        else if (documents.isEmpty)
                          Text(context.tr('Este expediente aún no tiene documentos.'), style: TextStyle(color: Colors.grey.shade600))
                        else
                          for (final doc in documents)
                            ListTile(
                              key: Key('expedient-doc-${doc['id']}'),
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.description_outlined, color: AppTheme.teal),
                              title: Text(doc['name'] as String? ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Text('${doc['code'] ?? ''} · v${doc['currentVersion'] ?? 1}', style: const TextStyle(fontSize: 12)),
                              trailing: StatusBadge(documentStatusLabel(doc['status'] as String?), tone: documentStatusTone(doc['status'] as String?)),
                              onTap: () => showDocumentDetail(context, widget.api, doc['id'] as String),
                            ),
                      ],
                    ),
                ],
              ),
            ),
    );
  }
}
