import 'package:flutter/material.dart';

class DashboardQuickActions extends StatelessWidget {
  const DashboardQuickActions({super.key, required this.onNavigateToTab});

  final void Function(int) onNavigateToTab;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Acciones Rápidas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xff111827))),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _ActionBtn(icon: Icons.note_add_outlined, label: 'Nuevo Doc', color: const Color(0xff087f7b), onTap: () => onNavigateToTab(1)),
            _ActionBtn(icon: Icons.upload_file_outlined, label: 'Subir', color: const Color(0xff3b82f6), onTap: () => onNavigateToTab(1)),
            _ActionBtn(icon: Icons.medical_services_outlined, label: 'Pacientes', color: const Color(0xff10b981), onTap: () => onNavigateToTab(3)),
            _ActionBtn(icon: Icons.check_circle_outline, label: 'Mis Tareas', color: const Color(0xfff59e0b), onTap: () => onNavigateToTab(2)),
          ],
        ),
      ],
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({required this.icon, required this.label, required this.color, required this.onTap});

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xff374151))),
        ],
      ),
    );
  }
}
