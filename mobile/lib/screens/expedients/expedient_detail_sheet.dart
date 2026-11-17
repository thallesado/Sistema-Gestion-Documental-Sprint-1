import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/document_model.dart';
import '../../core/models/expedient_model.dart';
import '../../core/models/workflow_instance_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../workflows/start_workflow_sheet.dart';
import '../workflows/workflow_tracking_sheet.dart';
import '../../core/i18n/app_language.dart';

/// Modal bottom sheet con el detalle completo del Expediente Digital.
/// Agrupa documentos y trámites bajo una misma radicación.
class ExpedientDetailSheet extends StatefulWidget {
  const ExpedientDetailSheet({
    super.key,
    required this.api,
    required this.expedientId,
    this.initialExpedient,
  });

  final AuthApi api;
  final String expedientId;
  final ExpedientModel? initialExpedient;

  @override
  State<ExpedientDetailSheet> createState() => _ExpedientDetailSheetState();
}

class _ExpedientDetailSheetState extends State<ExpedientDetailSheet> {
  ExpedientModel? expedient;
  List<WorkflowInstanceModel> workflows = [];
  List<DocumentModel> documents = [];
  bool loading = true;
  String? error;
  bool actionBusy = false;
  String? downloadingDocId;

  @override
  void initState() {
    super.initState();
    expedient = widget.initialExpedient;
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final loadedExpedient = await widget.api.expedients.getExpedient(widget.expedientId);
      List<WorkflowInstanceModel> loadedWorkflows = [];
      List<DocumentModel> loadedDocuments = [];

      // 1. Cargar workflows vinculados a este expediente
      if (widget.api.permissions.value.can(Permissions.workflowRead)) {
        try {
          final wfPage = await widget.api.workflows.list(filters: {'expedientId': widget.expedientId});
          final rawWfs = wfPage['content'] as List<dynamic>? ?? [];
          final mappedWfs = rawWfs.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          loadedWorkflows = mappedWfs.map(WorkflowInstanceModel.fromJson).toList();
        } catch (_) {
          loadedWorkflows = [];
        }
      }

      // 2. Cargar documentos vinculados a la radicación/expediente
      if (widget.api.permissions.value.can(Permissions.documentRead)) {
        try {
          loadedDocuments = await widget.api.documents.getDocuments(
            search: loadedExpedient.code,
            size: 50,
          );
        } catch (_) {
          loadedDocuments = [];
        }
      }

      if (!mounted) return;
      setState(() {
        expedient = loadedExpedient;
        workflows = loadedWorkflows;
        documents = loadedDocuments;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (e) {
      if (mounted) setState(() => error = 'Error al cargar expediente: $e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _updateExpedientStatus(String action, Future<ExpedientModel> Function() apiCall) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('¿Confirmar {action}?', {'action': action})),
        content: Text(tr('Esta acción actualizará el estado de la radicación {code}.', {'code': expedient?.code ?? ''})),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.tr('Cancelar'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('Confirmar')),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    if (!mounted) return;

    setState(() => actionBusy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final updated = await apiCall();
      if (!mounted) return;
      setState(() => expedient = updated);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(tr('Expediente actualizado: {status}', {'status': expedientStatusLabel(updated.status)}))),
        );
    } on ApiException catch (e) {
      if (mounted) {
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => actionBusy = false);
    }
  }

  Future<void> _downloadDocument(DocumentModel doc) async {
    setState(() => downloadingDocId = doc.id);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final versions = await widget.api.documents.versions(doc.id);
      if (versions.isEmpty) throw ApiException(tr('El documento no tiene versiones cargadas.'));
      final file = await widget.api.documents.downloadVersion(doc.id, versions.first);
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(tr('Descargado: {name}', {'name': file.path.split(RegExp(r'[\\/]')).last}))),
      );
    } on ApiException catch (e) {
      if (mounted) messenger.showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => downloadingDocId = null);
    }
  }

  Future<void> _startWorkflow() async {
    if (documents.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('No hay documentos vinculados para iniciar un flujo de aprobación.'))),
      );
      return;
    }

    final created = await showStartWorkflowSheet(
      context,
      widget.api,
      documentId: documents.first.id,
      documentName: '${expedient?.name ?? tr('Expediente')} (${expedient?.code ?? ''})',
    );

    if (created) {
      load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final exp = expedient;

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: Text(exp?.code ?? context.tr('Expediente Digital'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
          actions: [
            if (exp != null)
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Center(
                  child: StatusBadge(
                    expedientStatusLabel(exp.status),
                    tone: expedientStatusTone(exp.status),
                  ),
                ),
              ),
          ],
        ),
        body: loading && exp == null
            ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
            : error != null && exp == null
                ? ErrorStateView(message: error!, onRetry: load)
                : _content(scrollController, exp!),
      ),
    );
  }

  Widget _content(ScrollController scrollController, ExpedientModel exp) {
    final permissions = widget.api.permissions.value;
    final canUpdate = ExpedientPermissions.canUpdate(permissions);
    final canStartWf = WorkflowPermissions.canStart(permissions) && exp.isActive;

    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      children: [
        if (actionBusy) const LinearProgressIndicator(color: AppTheme.teal),
        // Encabezado de la Radicación
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.mint.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.folder_special, color: AppTheme.teal, size: 32),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    exp.name,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Radicación: ${exp.code} · ${formatDate(exp.createdAt, withTime: true)}',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (exp.description != null && exp.description!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Text(
              exp.description!,
              style: const TextStyle(fontSize: 14, color: AppTheme.ink, height: 1.4),
            ),
          ),
        ],

        // Participantes vinculados
        if (exp.participants.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(context.tr('Participantes de la radicación'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: exp.participants.map((p) => Chip(
              avatar: Icon(
                p.source == 'PATIENT' ? Icons.local_hospital : Icons.person_outline,
                size: 16,
                color: AppTheme.teal,
              ),
              label: Text('${p.name} (${p.role})', style: const TextStyle(fontSize: 12)),
              backgroundColor: AppTheme.mint.withValues(alpha: 0.3),
              side: BorderSide(color: AppTheme.teal.withValues(alpha: 0.3)),
            )).toList(),
          ),
        ],

        const Divider(height: 32),

        // SECCIÓN 1: Trámites y Workflows vinculados
        Row(
          children: [
            const Icon(Icons.account_tree_outlined, size: 20, color: AppTheme.teal),
            const SizedBox(width: 8),
            Text(
              'Trámites en curso (${workflows.length})',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
            ),
            const Spacer(),
            if (canStartWf)
              TextButton.icon(
                key: const Key('start-workflow-from-expedient'),
                onPressed: _startWorkflow,
                icon: const Icon(Icons.add, size: 18),
                label: Text(context.tr('Iniciar trámite')),
                style: TextButton.styleFrom(foregroundColor: AppTheme.teal),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (workflows.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 20, color: Colors.grey.shade600),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    context.tr('No hay trámites activos para esta radicación.'),
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                ),
              ],
            ),
          )
        else
          ...workflows.map((wf) => Card(
                key: Key('expedient-workflow-${wf.id}'),
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => showWorkflowTrackingSheet(context, widget.api, wf.id),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.mint,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                wf.code,
                                style: const TextStyle(color: AppTheme.teal, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                            const Spacer(),
                            StatusBadge(workflowStatusLabel(wf.status), tone: workflowStatusTone(wf.status)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          wf.title,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.ink),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tr('Etapa: {stage} · Responsable: {responsible}', {'stage': wf.stageName ?? tr('Inicio'), 'responsible': wf.responsibleName ?? tr('Sin asignar')}),
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: wf.progress / 100.0,
                                  backgroundColor: Colors.grey.shade200,
                                  color: AppTheme.teal,
                                  minHeight: 6,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text('${wf.progress}%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            const SizedBox(width: 8),
                            const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              )),

        const Divider(height: 32),

        // SECCIÓN 2: Documentos agrupados bajo la radicación
        Row(
          children: [
            const Icon(Icons.description_outlined, size: 20, color: AppTheme.teal),
            const SizedBox(width: 8),
            Text(
              'Documentos radicados (${documents.length})',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (documents.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 20, color: Colors.grey.shade600),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    context.tr('No hay documentos radicados con este código de expediente.'),
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                ),
              ],
            ),
          )
        else
          ...documents.map((doc) => Card(
                key: Key('expedient-doc-${doc.id}'),
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppTheme.mint,
                    child: const Icon(Icons.description, color: AppTheme.teal, size: 20),
                  ),
                  title: Text(doc.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${doc.code.isEmpty ? tr('Doc') : doc.code} · v${doc.currentVersion} · ${formatDate(doc.createdAt)}'),
                  trailing: downloadingDocId == doc.id
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal))
                      : IconButton(
                          key: Key('download-doc-${doc.id}'),
                          icon: const Icon(Icons.download, color: AppTheme.teal),
                          tooltip: context.tr('Descargar archivo'),
                          onPressed: downloadingDocId == null ? () => _downloadDocument(doc) : null,
                        ),
                ),
              )),

        // SECCIÓN 3: Acciones Administrativas de Ciclo de Vida
        if (canUpdate) ...[
          const Divider(height: 32),
          Text(context.tr('Acciones del expediente'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (exp.isActive)
                OutlinedButton.icon(
                  key: const Key('close-expedient-button'),
                  onPressed: actionBusy
                      ? null
                      : () => _updateExpedientStatus(context.tr('cierre de expediente'), () => widget.api.expedients.closeExpedient(exp.id)),
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: Text(context.tr('Cerrar expediente')),
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.ink),
                ),
              if (!exp.isArchived)
                OutlinedButton.icon(
                  key: const Key('archive-expedient-button'),
                  onPressed: actionBusy
                      ? null
                      : () => _updateExpedientStatus(context.tr('archivo de expediente'), () => widget.api.expedients.archiveExpedient(exp.id)),
                  icon: const Icon(Icons.archive_outlined, size: 18),
                  label: Text(context.tr('Archivar expediente')),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.orange.shade800),
                ),
              if (exp.isClosed || exp.isArchived)
                FilledButton.icon(
                  key: const Key('reopen-expedient-button'),
                  onPressed: actionBusy
                      ? null
                      : () => _updateExpedientStatus(context.tr('reapertura de expediente'), () => widget.api.expedients.reopenExpedient(exp.id)),
                  icon: const Icon(Icons.lock_open, size: 18),
                  label: Text(context.tr('Reabrir expediente')),
                  style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
                ),
            ],
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

/// Helper para abrir la hoja modal de detalle de un expediente.
Future<void> showExpedientDetailSheet(
  BuildContext context,
  AuthApi api,
  String expedientId, {
  ExpedientModel? expedient,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ExpedientDetailSheet(
      api: api,
      expedientId: expedientId,
      initialExpedient: expedient,
    ),
  );
}
