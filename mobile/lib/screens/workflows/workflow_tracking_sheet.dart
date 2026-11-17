import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/workflow_instance_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';

/// Abre la hoja modal con la línea de tiempo y eventos de un trámite (workflow).
Future<void> showWorkflowTrackingSheet(BuildContext context, AuthApi api, String workflowId) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.78,
        maxChildSize: 0.95,
        builder: (context, controller) => WorkflowTrackingSheet(
          api: api,
          workflowId: workflowId,
          scrollController: controller,
        ),
      ),
    );

/// Tarjeta resumen del estado de trámite mostrada dentro del detalle de documento.
class DocumentWorkflowCard extends StatelessWidget {
  const DocumentWorkflowCard({
    super.key,
    required this.workflow,
    required this.onTapTimeline,
  });

  final WorkflowInstanceModel workflow;
  final VoidCallback onTapTimeline;

  @override
  Widget build(BuildContext context) {
    final progressValue = (workflow.progress / 100).clamp(0.0, 1.0);
    return Card(
      elevation: 0,
      color: AppTheme.mint.withValues(alpha: 0.28),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppTheme.teal.withValues(alpha: 0.22)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (workflow.code.isNotEmpty) ...[
                  Text(
                    workflow.code,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.teal),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    workflow.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.ink),
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(workflowStatusLabel(workflow.status), tone: workflowStatusTone(workflow.status)),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progressValue,
                      minHeight: 7,
                      backgroundColor: Colors.white,
                      color: workflow.isRejected ? Colors.red.shade600 : AppTheme.teal,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  '${workflow.progress}%',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.ink),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _metaRow(Icons.flag_outlined, 'Etapa actual', workflow.stageName ?? (workflow.isCompleted ? 'Finalizado' : '—')),
            const SizedBox(height: 4),
            _metaRow(Icons.person_outline, 'Responsable', workflow.responsibleName ?? 'Por asignar'),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                key: const Key('open-workflow-timeline'),
                onPressed: onTapTimeline,
                icon: const Icon(Icons.timeline, size: 18),
                label: const Text('Ver seguimiento'),
                style: TextButton.styleFrom(foregroundColor: AppTheme.teal),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaRow(IconData icon, String label, String value) => Row(
        children: [
          Icon(icon, size: 15, color: Colors.grey.shade700),
          const SizedBox(width: 6),
          Text('$label: ', style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
          Expanded(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.ink),
            ),
          ),
        ],
      );
}

class WorkflowTrackingSheet extends StatefulWidget {
  const WorkflowTrackingSheet({
    super.key,
    required this.api,
    required this.workflowId,
    this.scrollController,
  });

  final AuthApi api;
  final String workflowId;
  final ScrollController? scrollController;

  @override
  State<WorkflowTrackingSheet> createState() => _WorkflowTrackingSheetState();
}

class _WorkflowTrackingSheetState extends State<WorkflowTrackingSheet> {
  WorkflowInstanceModel? workflow;
  String? error;
  bool loading = true;

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
      final result = await widget.api.workflows.getWorkflowDetail(widget.workflowId);
      if (mounted) setState(() => workflow = result);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    if (error != null) return ErrorStateView(message: error!, onRetry: load);
    final wf = workflow!;
    final progressValue = (wf.progress / 100).clamp(0.0, 1.0);
    final events = wf.events.reversed.toList();

    return ListView(
      controller: widget.scrollController,
      padding: const EdgeInsets.all(24),
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.teal.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.timeline, color: AppTheme.teal, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (wf.code.isNotEmpty)
                    Text(wf.code, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.teal)),
                  Text(wf.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.ink)),
                  if ((wf.templateName ?? '').isNotEmpty)
                    Text(
                      wf.templateVersion != null ? '${wf.templateName} · v${wf.templateVersion}' : wf.templateName!,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(workflowStatusLabel(wf.status), tone: workflowStatusTone(wf.status)),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Progreso del trámite', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  Text(
                    wf.totalSteps > 0
                        ? '${wf.progress}% (${wf.completedSteps}/${wf.totalSteps} etapas)'
                        : '${wf.progress}%',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.teal),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progressValue,
                  minHeight: 8,
                  backgroundColor: Colors.grey.shade200,
                  color: wf.isRejected ? Colors.red.shade600 : AppTheme.teal,
                ),
              ),
              const SizedBox(height: 12),
              _infoRow('Solicitante', wf.creatorName),
              _infoRow('Responsable actual', wf.responsibleName ?? (wf.isCompleted ? 'Finalizado' : 'Por asignar')),
              if ((wf.finalApproverName ?? '').isNotEmpty) _infoRow('Aprobador final', wf.finalApproverName),
              if ((wf.departmentName ?? '').isNotEmpty) _infoRow('Área', wf.departmentName),
              if (wf.dueAt != null) _infoRow('Vencimiento', formatDate(wf.dueAt!.toIso8601String(), withTime: true)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('Etapas del trámite', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 10),
        if (wf.stages.isEmpty)
          Text('Este trámite no tiene etapas registradas.', style: TextStyle(color: Colors.grey.shade600))
        else
          Column(
            key: const Key('workflow-stages-timeline'),
            children: [
              for (var i = 0; i < wf.stages.length; i++)
                _StageTimelineTile(
                  stage: wf.stages[i],
                  isLast: i == wf.stages.length - 1,
                ),
            ],
          ),
        const SizedBox(height: 20),
        const Text(
          'Historial de eventos y observaciones',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.ink),
        ),
        const SizedBox(height: 10),
        if (events.isEmpty)
          Text('Sin eventos registrados.', style: TextStyle(color: Colors.grey.shade600))
        else
          Column(
            key: const Key('workflow-events-list'),
            children: [
              for (final event in events) _EventTile(event: event),
            ],
          ),
      ],
    );
  }

  Widget _infoRow(String label, String? value) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            SizedBox(width: 126, child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
            Expanded(
              child: Text(
                value != null && value.isNotEmpty ? value : '—',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.ink),
              ),
            ),
          ],
        ),
      );
}

class _StageTimelineTile extends StatelessWidget {
  const _StageTimelineTile({required this.stage, required this.isLast});

  final WorkflowStageProgressModel stage;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (stage.state) {
      'COMPLETED' => (const Color(0xffd1fae5), const Color(0xff065f46), Icons.check),
      'CURRENT' => (AppTheme.mint, AppTheme.teal, Icons.radio_button_checked),
      'REJECTED' => (const Color(0xfffee2e2), const Color(0xff991b1b), Icons.close),
      _ => (Colors.grey.shade200, Colors.grey.shade500, Icons.circle_outlined),
    };

    final stateLabel = switch (stage.state) {
      'COMPLETED' => 'Completada',
      'CURRENT' => 'En curso',
      'REJECTED' => 'Detenida / Rechazada',
      _ => 'Pendiente',
    };

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
                child: Icon(icon, size: 16, color: fg),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: stage.state == 'COMPLETED' ? const Color(0xff065f46).withValues(alpha: 0.35) : Colors.grey.shade300,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 4 : 16, top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          stage.name,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: stage.state == 'CURRENT' ? FontWeight.bold : FontWeight.w600,
                            color: stage.state == 'PENDING' ? Colors.grey.shade700 : AppTheme.ink,
                          ),
                        ),
                      ),
                      Text(
                        stateLabel,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      stageTypeLabel(stage.stageType),
                      if (stage.dueDays != null && stage.dueDays! > 0) 'Plazo: ${stage.dueDays} días',
                    ].join(' · '),
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});

  final WorkflowEventModel event;

  @override
  Widget build(BuildContext context) {
    final comment = event.comment?.trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.history, size: 16, color: AppTheme.teal),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  workflowEventLabel(event.eventType),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.ink),
                ),
              ),
              Text(
                formatDate(event.performedAt?.toIso8601String(), withTime: true),
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            event.actorName?.isNotEmpty == true ? event.actorName! : 'Sistema',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
          ),
          if (comment != null && comment.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.mint.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                comment,
                style: const TextStyle(fontSize: 12, color: AppTheme.ink),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
