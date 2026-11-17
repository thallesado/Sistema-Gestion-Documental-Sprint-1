import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/workflow_task_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import 'task_detail_page.dart';

/// Pestañas de "Mis tareas" de la web: Pendientes, En progreso, Completadas, Vencidas.
const taskFilters = <String, Map<String, dynamic>>{
  'Pendientes': {'status': 'PENDING'},
  'En progreso': {'status': 'IN_PROGRESS'},
  'Vencidas': {'overdue': true},
  'Completadas': {'status': 'COMPLETED'},
  'Todas': {},
};

String taskActionLabel(String action) => switch (action) {
  'APPROVE' => 'Aprobar',
  'REVIEW' => 'Revisar',
  'COMPLETE' => 'Completar',
  'REJECT' => 'Rechazar',
  'RETURN' => 'Devolver',
  _ => action,
};

String defaultActionForStage(String? stageType) => switch (stageType ?? 'TASK') {
  'APPROVAL' => 'APPROVE',
  'REVIEW' => 'REVIEW',
  _ => 'COMPLETE',
};

class TasksTab extends StatefulWidget {
  const TasksTab({super.key, required this.api, this.biometricService});

  final AuthApi api;
  final BiometricService? biometricService;

  @override
  State<TasksTab> createState() => _TasksTabState();
}

class _TasksTabState extends State<TasksTab> {
  List<WorkflowTaskModel> tasks = [];
  bool loading = true;
  String? error;
  String selectedFilter = 'Pendientes';
  String? processingTaskId;

  // Modo de selección múltiple (Bulk Approve)
  bool bulkMode = false;
  final Set<String> selectedTaskIds = <String>{};
  bool processingBulk = false;

  late final BiometricService _biometrics = widget.biometricService ?? BiometricService();

  @override
  void initState() {
    super.initState();
    loadTasks();
  }

  List<WorkflowTaskModel> get actionableTasks => tasks.where((t) {
        final s = t.status;
        return t.canAct && s != 'COMPLETED' && s != 'REJECTED' && s != 'CANCELED';
      }).toList();

  Future<void> loadTasks() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final taskList = await widget.api.workflows.getTasks(filters: taskFilters[selectedFilter]!);
      if (mounted) {
        setState(() {
          tasks = taskList;
          selectedTaskIds.removeWhere((id) => !taskList.any((t) => t.id == id));
          if (actionableTasks.isEmpty) bulkMode = false;
        });
      }
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _toggleBulkMode() {
    setState(() {
      bulkMode = !bulkMode;
      selectedTaskIds.clear();
    });
  }

  void _toggleTaskSelection(String taskId) {
    setState(() {
      if (selectedTaskIds.contains(taskId)) {
        selectedTaskIds.remove(taskId);
      } else {
        selectedTaskIds.add(taskId);
      }
    });
  }

  void _selectAllActionable() {
    final allIds = actionableTasks.map((t) => t.id).toSet();
    setState(() {
      if (selectedTaskIds.length == allIds.length) {
        selectedTaskIds.clear();
      } else {
        selectedTaskIds
          ..clear()
          ..addAll(allIds);
      }
    });
  }

  Future<void> executeBulkApprove() async {
    if (selectedTaskIds.isEmpty || processingBulk) return;
    final messenger = ScaffoldMessenger.of(context);
    final selectedList = actionableTasks.where((t) => selectedTaskIds.contains(t.id)).toList();
    if (selectedList.isEmpty) return;

    if (await _biometrics.isEnabled()) {
      final authenticated = await _biometrics.authenticate(
        reason: 'Confirma tu identidad biométrica para aprobar ${selectedList.length} tareas en bloque',
      );
      if (!authenticated) {
        messenger.showSnackBar(
          const SnackBar(content: Text('Aprobación en bloque cancelada: se requiere verificación biométrica.')),
        );
        return;
      }
    }

    if (!mounted) return;
    setState(() => processingBulk = true);

    int successCount = 0;
    String? lastError;

    for (final task in selectedList) {
      try {
        final action = defaultActionForStage(task.stageType);
        await widget.api.workflows.act(task.id, action, comment: 'Aprobación ejecutiva en bloque desde NexoDocs Mobile');
        successCount++;
      } on ApiException catch (e) {
        lastError = e.message;
      } catch (e) {
        lastError = '$e';
      }
    }

    if (!mounted) return;
    setState(() {
      processingBulk = false;
      bulkMode = false;
      selectedTaskIds.clear();
    });

    if (successCount > 0) {
      messenger.showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.teal,
          content: Text('Aprobación en bloque completada: $successCount tareas procesadas.'),
        ),
      );
    } else if (lastError != null) {
      messenger.showSnackBar(
        SnackBar(
          backgroundColor: Colors.red.shade700,
          content: Text('No se pudieron procesar las tareas: $lastError'),
        ),
      );
    }

    await loadTasks();
  }

  Future<void> quickAction(WorkflowTaskModel task, String action) async {
    final taskId = task.id;
    final messenger = ScaffoldMessenger.of(context);
    if (action == 'APPROVE' && await _biometrics.isEnabled()) {
      final authenticated = await _biometrics.authenticate(
        reason: 'Confirma tu identidad para aprobar la tarea',
      );
      if (!authenticated) {
        messenger.showSnackBar(
          const SnackBar(content: Text('Aprobación cancelada: se requiere verificación biométrica.')),
        );
        return;
      }
    }
    if (!mounted) return;
    setState(() => processingTaskId = taskId);
    try {
      await widget.api.workflows.act(taskId, action);
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text('Operación "${taskActionLabel(action)}" completada con éxito.'),
      ));
      await loadTasks();
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text(e.message),
        backgroundColor: Colors.red.shade700,
        action: SnackBarAction(
          label: 'Ver detalle',
          textColor: Colors.white,
          onPressed: () => openTask(task),
        ),
      ));
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text('Error: $e'),
        backgroundColor: Colors.red.shade700,
      ));
    } finally {
      if (mounted) setState(() => processingTaskId = null);
    }
  }

  Future<void> openTask(WorkflowTaskModel task) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskDetailPage(api: widget.api, taskId: task.id)),
    );
    if (changed == true) loadTasks();
  }

  @override
  Widget build(BuildContext context) {
    final canBulk = actionableTasks.isNotEmpty;

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: taskFilters.keys.map((filter) {
                          final selected = selectedFilter == filter;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: FilterChip(
                              label: Text(filter),
                              selected: selected,
                              onSelected: (_) {
                                setState(() {
                                  selectedFilter = filter;
                                  bulkMode = false;
                                  selectedTaskIds.clear();
                                });
                                loadTasks();
                              },
                              selectedColor: AppTheme.mint,
                              checkmarkColor: AppTheme.teal,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                                color: selected ? AppTheme.teal : const Color(0xff374151),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  if (canBulk) ...[
                    const SizedBox(width: 6),
                    TextButton.icon(
                      key: const Key('toggle-bulk-mode-button'),
                      onPressed: _toggleBulkMode,
                      icon: Icon(bulkMode ? Icons.close : Icons.checklist_rtl, size: 18),
                      label: Text(
                        bulkMode ? 'Cancelar' : 'En bloque',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: bulkMode ? Colors.red.shade700 : AppTheme.teal,
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ],
                ],
              ),
              if (bulkMode)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          'Selecciona las tareas para firmar',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                        ),
                      ),
                      TextButton(
                        key: const Key('bulk-select-all-button'),
                        onPressed: _selectAllActionable,
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.teal,
                          visualDensity: VisualDensity.compact,
                        ),
                        child: Text(
                          selectedTaskIds.length == actionableTasks.length ? 'Desmarcar todas' : 'Seleccionar todas',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (loading || processingBulk) const LinearProgressIndicator(color: AppTheme.teal),
        Expanded(
          child: RefreshIndicator(
            onRefresh: loadTasks,
            color: AppTheme.teal,
            child: error != null
                ? ErrorStateView(message: error!, onRetry: loadTasks)
                : tasks.isEmpty && !loading
                ? const EmptyStateView(message: 'No tienes tareas en esta selección.', icon: Icons.task_alt)
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: tasks.length,
                    itemBuilder: (context, index) {
                      final t = tasks[index];
                      final isSelected = selectedTaskIds.contains(t.id);
                      return _TaskCard(
                        task: t,
                        bulkMode: bulkMode,
                        isSelected: isSelected,
                        onToggleSelect: () => _toggleTaskSelection(t.id),
                        onTap: () => bulkMode ? _toggleTaskSelection(t.id) : openTask(t),
                        isProcessing: processingTaskId == t.id,
                        onQuickAction: (action) => quickAction(t, action),
                      );
                    },
                  ),
          ),
        ),
        if (bulkMode && selectedTaskIds.isNotEmpty)
          Container(
            key: const Key('bulk-approve-bar'),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.mint,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${selectedTaskIds.length} seleccionadas',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.tealDark,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      key: const Key('bulk-approve-submit-button'),
                      onPressed: processingBulk ? null : executeBulkApprove,
                      icon: const Icon(Icons.fingerprint, size: 20),
                      label: Text(
                        processingBulk ? 'Procesando...' : 'Firmar y Aprobar (${selectedTaskIds.length})',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.teal,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.onTap,
    this.bulkMode = false,
    this.isSelected = false,
    this.onToggleSelect,
    this.isProcessing = false,
    this.onQuickAction,
  });

  final WorkflowTaskModel task;
  final VoidCallback onTap;
  final bool bulkMode;
  final bool isSelected;
  final VoidCallback? onToggleSelect;
  final bool isProcessing;
  final ValueChanged<String>? onQuickAction;

  @override
  Widget build(BuildContext context) {
    final status = task.status;
    final overdue = status != 'COMPLETED' && isPast(task['due_at']);
    final canAct = task.canAct && status != 'COMPLETED' && status != 'REJECTED' && status != 'CANCELED';
    final action = defaultActionForStage(task.stageType);
    final actionLabel = switch (action) {
      'APPROVE' => 'Aprobar',
      'REVIEW' => 'Revisar',
      _ => 'Completar',
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      color: isSelected ? AppTheme.mint.withValues(alpha: 0.22) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected ? AppTheme.teal : Colors.grey.shade200,
          width: isSelected ? 1.5 : 1.0,
        ),
      ),
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
                  if (bulkMode && canAct) ...[
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: Checkbox(
                        key: Key('bulk-checkbox-${task.id}'),
                        value: isSelected,
                        activeColor: AppTheme.teal,
                        onChanged: (_) => onToggleSelect?.call(),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task.title,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.ink),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${task.workflowTitle ?? ''} · ${task.workflowCode ?? ''}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  if (!bulkMode && canAct && onQuickAction != null) ...[
                    const SizedBox(width: 8),
                    if (isProcessing)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal)),
                      )
                    else
                      OutlinedButton.icon(
                        key: Key('quick-action-${task.id}'),
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
                  StatusBadge(stageTypeLabel(task.stageType), tone: BadgeTone.brand),
                  StatusBadge('Prioridad ${priorityLabel(task.priority)}', tone: task.priority <= 2 ? BadgeTone.danger : BadgeTone.warning),
                ],
              ),
              if (task['due_at'] != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Vence: ${formatDate(task['due_at'], withTime: true)}',
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
