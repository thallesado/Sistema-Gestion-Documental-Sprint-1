import 'package:flutter/material.dart';

class TaskItemCard extends StatelessWidget {
  const TaskItemCard({
    super.key,
    required this.task,
    required this.onToggle,
  });

  final Map<String, dynamic> task;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
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
        child: Row(
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
              onPressed: onToggle,
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
      ),
    );
  }
}
