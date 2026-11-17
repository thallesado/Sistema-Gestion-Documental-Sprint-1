import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_views.dart';
import '../../features/tasks/presentation/widgets/task_item_card.dart';
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
  'APPROVE' => tr('Aprobar'),
  'REVIEW' => tr('Revisar'),
  'COMPLETE' => tr('Completar'),
  'REJECT' => tr('Rechazar'),
  'RETURN' => tr('Devolver'),
  _ => action,
};

class TasksTab extends StatefulWidget {
  const TasksTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<TasksTab> createState() => _TasksTabState();
}

class _TasksTabState extends State<TasksTab> {
  List<Map<String, dynamic>> tasks = [];
  bool loading = true;
  String? error;
  String selectedFilter = 'Pendientes';
  String? processingTaskId;

  @override
  void initState() {
    super.initState();
    loadTasks();
  }

  Future<void> loadTasks() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final page = await widget.api.workflows.tasks(filters: taskFilters[selectedFilter]!);
      if (mounted) setState(() => tasks = (page['content'] as List<dynamic>).cast<Map<String, dynamic>>());
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> quickAction(Map<String, dynamic> task, String action) async {
    final taskId = task['id'] as String;
    setState(() => processingTaskId = taskId);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.api.workflows.act(taskId, action);
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text(tr('Operación "{action}" completada con éxito.', {'action': taskActionLabel(action)})),
      ));
      await loadTasks();
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text(e.message),
        backgroundColor: Colors.red.shade700,
        action: SnackBarAction(
          label: tr('Ver detalle'),
          textColor: Colors.white,
          onPressed: () => openTask(task),
        ),
      ));
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text(tr('Error: {error}', {'error': e})),
        backgroundColor: Colors.red.shade700,
      ));
    } finally {
      if (mounted) setState(() => processingTaskId = null);
    }
  }

  Future<void> openTask(Map<String, dynamic> task) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskDetailPage(api: widget.api, taskId: task['id'] as String)),
    );
    if (changed == true) loadTasks();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: taskFilters.keys.map((filter) {
              final selected = selectedFilter == filter;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(context.tr(filter)),
                  selected: selected,
                  onSelected: (_) {
                    setState(() => selectedFilter = filter);
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
      if (loading) const LinearProgressIndicator(color: AppTheme.teal),
      Expanded(
        child: RefreshIndicator(
          onRefresh: loadTasks,
          color: AppTheme.teal,
          child: error != null
              ? ErrorStateView(message: error!, onRetry: loadTasks)
              : tasks.isEmpty && !loading
              ? EmptyStateView(message: tr('No tienes tareas en esta selección.'), icon: Icons.task_alt)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: tasks.length,
                  itemBuilder: (context, index) {
                    final t = tasks[index];
                    return TaskItemCard(
                      task: t,
                      onTap: () => openTask(t),
                      isProcessing: processingTaskId == t['id'],
                      onQuickAction: (action) => quickAction(t, action),
                    );
                  },
                ),
        ),
      ),
    ],
  );
}


