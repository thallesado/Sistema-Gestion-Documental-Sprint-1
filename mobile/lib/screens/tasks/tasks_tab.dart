import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../../features/tasks/presentation/widgets/task_item_card.dart';

class TasksTab extends StatefulWidget {
  const TasksTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<TasksTab> createState() => _TasksTabState();
}

class _TasksTabState extends State<TasksTab> {
  List<Map<String, dynamic>> allTasks = [];
  bool loading = true;
  String selectedFilter = 'Todas';

  final filters = ['Todas', 'Pendientes', 'En revisión', 'Completadas'];

  @override
  void initState() {
    super.initState();
    loadTasks();
  }

  Future<void> loadTasks() async {
    setState(() => loading = true);
    try {
      final data = await widget.api.dashboard();
      final tasks = (data['tasks'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      if (mounted) setState(() => allTasks = tasks);
    } catch (_) {
      if (mounted) {
        setState(() {
          allTasks = [
            {
              'id': '1',
              'title': 'Revisión técnica de contrato marco',
              'status': 'PENDING',
              'priority': 1,
              'dueAt': '2026-09-30T18:00:00Z',
              'area': 'Legal',
            },
            {
              'id': '2',
              'title': 'Aprobación de orden de compra #892',
              'status': 'IN_REVIEW',
              'priority': 2,
              'dueAt': '2026-10-02T12:00:00Z',
              'area': 'Compras',
            },
            {
              'id': '3',
              'title': 'Firma digital de acta de entrega',
              'status': 'COMPLETED',
              'priority': 3,
              'dueAt': '2026-09-24T17:00:00Z',
              'area': 'Operaciones',
            },
          ];
        });
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void toggleTask(String id) {
    setState(() {
      for (final t in allTasks) {
        if (t['id'] == id) {
          final current = t['status'] as String? ?? 'PENDING';
          t['status'] = current == 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        }
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Estado de la tarea actualizado'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  List<Map<String, dynamic>> get filteredTasks {
    if (selectedFilter == 'Pendientes') {
      return allTasks.where((t) => t['status'] == 'PENDING').toList();
    }
    if (selectedFilter == 'En revisión') {
      return allTasks.where((t) => t['status'] == 'IN_REVIEW').toList();
    }
    if (selectedFilter == 'Completadas') {
      return allTasks.where((t) => t['status'] == 'COMPLETED').toList();
    }
    return allTasks;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: filters.map((f) {
              final selected = f == selectedFilter;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(f),
                  selected: selected,
                  selectedColor: const Color(0xff087f7b).withOpacity(0.15),
                  checkmarkColor: const Color(0xff087f7b),
                  labelStyle: TextStyle(
                    color: selected ? const Color(0xff087f7b) : const Color(0xff4b5563),
                    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (val) {
                    setState(() => selectedFilter = f);
                  },
                ),
              );
            }).toList(),
          ),
        ),

        if (loading) const LinearProgressIndicator(color: Color(0xff087f7b)),

        Expanded(
          child: RefreshIndicator(
            onRefresh: loadTasks,
            color: const Color(0xff087f7b),
            child: filteredTasks.isEmpty && !loading
                ? Center(
                    child: Text(
                      'No hay tareas en esta categoría.',
                      style: TextStyle(color: Colors.grey.shade500),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredTasks.length,
                    itemBuilder: (context, index) {
                      final task = filteredTasks[index];
                      final id = task['id'] as String? ?? '$index';
                      return TaskItemCard(
                        task: task,
                        onToggle: () => toggleTask(id),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
