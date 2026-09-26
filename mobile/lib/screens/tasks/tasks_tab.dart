import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';

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
      // Default sample tasks if offline
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
        // Filter chips bar
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: filters.map((f) {
                final selected = selectedFilter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(f),
                    selected: selected,
                    onSelected: (_) => setState(() => selectedFilter = f),
                    selectedColor: const Color(0xffd4ece7),
                    checkmarkColor: const Color(0xff087f7b),
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                      color: selected ? const Color(0xff087f7b) : const Color(0xff374151),
                    ),
                  ),
                );
              }).toList(),
            ),
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
                      final title = task['title'] as String? ?? 'Tarea';
                      final status = task['status'] as String? ?? 'PENDING';
                      final isDone = status == 'COMPLETED';
                      final isReview = status == 'IN_REVIEW';
                      final priority = task['priority'] as int? ?? 2;
                      final priorityLabel = priority == 1 ? 'Alta' : priority == 2 ? 'Media' : 'Baja';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  IconButton(
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(),
                                    icon: Icon(
                                      isDone ? Icons.check_circle : Icons.radio_button_unchecked,
                                      color: isDone ? const Color(0xff10b981) : const Color(0xffd97706),
                                      size: 24,
                                    ),
                                    onPressed: () => toggleTask(id),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          title,
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            decoration: isDone ? TextDecoration.lineThrough : null,
                                            color: isDone ? Colors.grey : const Color(0xff1f2937),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: priority == 1
                                                    ? const Color(0xfffee2e2)
                                                    : const Color(0xfffef3c7),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                'Prioridad $priorityLabel',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: priority == 1
                                                      ? const Color(0xff991b1b)
                                                      : const Color(0xff92400e),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: isDone
                                                    ? const Color(0xffd1fae5)
                                                    : isReview
                                                        ? const Color(0xffe0f2fe)
                                                        : const Color(0xfff3f4f6),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                isDone ? 'Completada' : isReview ? 'En revisión' : 'Pendiente',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: isDone
                                                      ? const Color(0xff065f46)
                                                      : isReview
                                                          ? const Color(0xff0369a1)
                                                          : const Color(0xff4b5563),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
