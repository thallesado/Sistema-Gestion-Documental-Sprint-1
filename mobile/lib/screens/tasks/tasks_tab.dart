import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
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
                  label: Text(filter),
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
              ? const EmptyStateView(message: 'No tienes tareas en esta selección.', icon: Icons.task_alt)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: tasks.length,
                  itemBuilder: (context, index) => _TaskCard(task: tasks[index], onTap: () => openTask(tasks[index])),
                ),
        ),
      ),
    ],
  );
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task, required this.onTap});

  final Map<String, dynamic> task;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = task['status'] as String?;
    final overdue = status != 'COMPLETED' && isPast(task['due_at']);
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
                children: [
                  Expanded(
                    child: Text(
                      task['title'] as String? ?? 'Tarea',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.ink),
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${task['workflow_title'] ?? ''} · ${task['workflow_code'] ?? ''}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  StatusBadge(taskStatusLabel(status), tone: taskStatusTone(status)),
                  StatusBadge(stageTypeLabel(task['stage_type'] as String?), tone: BadgeTone.brand),
                  StatusBadge('Prioridad ${priorityLabel(task['priority'])}', tone: (task['priority'] as int? ?? 4) <= 2 ? BadgeTone.danger : BadgeTone.warning),
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
