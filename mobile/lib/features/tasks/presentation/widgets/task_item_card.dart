import 'package:flutter/material.dart';

import '../../../../core/i18n/app_language.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/format.dart';
import '../../../../core/widgets/state_views.dart';

/// Tarjeta de una tarea de "Mis tareas". Muestra estado, etapa y prioridad, y ofrece la acción
/// rápida (Aprobar / Revisar / Completar) solo cuando el servidor indica `can_act`.
class TaskItemCard extends StatelessWidget {
  const TaskItemCard({
    super.key,
    required this.task,
    required this.onTap,
    this.isProcessing = false,
    this.onQuickAction,
  });

  final Map<String, dynamic> task;
  final VoidCallback onTap;
  final bool isProcessing;
  final ValueChanged<String>? onQuickAction;

  @override
  Widget build(BuildContext context) {
    final status = task['status'] as String?;
    final overdue = status != 'COMPLETED' && isPast(task['due_at']);
    final canAct = task['can_act'] == true && status != 'COMPLETED' && status != 'REJECTED' && status != 'CANCELED';
    final stageType = task['stage_type'] as String? ?? 'TASK';
    final action = switch (stageType) {
      'APPROVAL' => 'APPROVE',
      'REVIEW' => 'REVIEW',
      _ => 'COMPLETE',
    };
    final actionLabel = switch (action) {
      'APPROVE' => tr('Aprobar'),
      'REVIEW' => tr('Revisar'),
      _ => tr('Completar'),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task['title'] as String? ?? tr('Tarea'),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.ink),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${task['workflow_title'] ?? ''} · ${task['workflow_code'] ?? ''}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  if (canAct && onQuickAction != null) ...[
                    const SizedBox(width: 8),
                    if (isProcessing)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal)),
                      )
                    else
                      OutlinedButton.icon(
                        key: Key('quick-action-${task['id']}'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.teal,
                          side: const BorderSide(color: AppTheme.teal),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          minimumSize: const Size(0, 32),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        icon: const Icon(Icons.check_circle_outline, size: 16),
                        label: Text(actionLabel, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        onPressed: () => onQuickAction!(action),
                      ),
                  ],
                  const SizedBox(width: 4),
                  const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  StatusBadge(taskStatusLabel(status), tone: taskStatusTone(status)),
                  StatusBadge(stageTypeLabel(task['stage_type'] as String?), tone: BadgeTone.brand),
                  StatusBadge(tr('Prioridad {priority}', {'priority': priorityLabel(task['priority'])}), tone: (task['priority'] as int? ?? 4) <= 2 ? BadgeTone.danger : BadgeTone.warning),
                ],
              ),
              if (task['due_at'] != null) ...[
                const SizedBox(height: 8),
                Text(
                  tr('Vence: {date}', {'date': formatDate(task['due_at'], withTime: true)}),
                  style: TextStyle(fontSize: 12, color: overdue ? const Color(0xffb73838) : Colors.grey.shade700, fontWeight: overdue ? FontWeight.w600 : null),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
