import 'package:flutter/material.dart';

class DashboardWelcomeCard extends StatelessWidget {
  const DashboardWelcomeCard({
    super.key,
    required this.firstName,
    required this.lastName,
    required this.tenantId,
    required this.pendingTasks,
  });

  final String firstName;
  final String lastName;
  final String tenantId;
  final int pendingTasks;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xff087f7b), Color(0xff0f4c47)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xff087f7b).withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.apartment, color: Colors.white, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      tenantId,
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.notifications_none, color: Colors.white, size: 22),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Hola, $firstName $lastName',
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            pendingTasks > 0 ? 'Tienes $pendingTasks tareas que requieren tu atención' : 'Todo al día por aquí.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13),
          ),
        ],
      ),
    );
  }
}
