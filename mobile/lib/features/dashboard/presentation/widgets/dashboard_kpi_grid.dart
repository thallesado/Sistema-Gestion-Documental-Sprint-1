import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Dos indicadores del inicio: tareas pendientes y documentos con actividad reciente.
/// Las cifras vienen de `GET /dashboard`; cada tarjeta lleva a su pestaña.
class DashboardKpiGrid extends StatelessWidget {
  const DashboardKpiGrid({
    super.key,
    required this.pendingTotal,
    required this.docCount,
    required this.pendingTitle,
    required this.pendingSubtitle,
    required this.docsTitle,
    required this.docsSubtitle,
    required this.onNavigateToTab,
  });

  final int pendingTotal;
  final int docCount;
  final String pendingTitle;
  final String pendingSubtitle;
  final String docsTitle;
  final String docsSubtitle;
  final void Function(int tabIndex) onNavigateToTab;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _KpiCard(
            title: pendingTitle,
            value: '$pendingTotal',
            subtitle: pendingSubtitle,
            icon: Icons.check_circle_outline,
            color: const Color(0xffd97706),
            onTap: () => onNavigateToTab(2),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _KpiCard(
            title: docsTitle,
            value: '$docCount',
            subtitle: docsSubtitle,
            icon: Icons.description_outlined,
            color: AppTheme.teal,
            onTap: () => onNavigateToTab(1),
          ),
        ),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xffe5e7eb)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(child: Text(title, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xff6b7280), fontSize: 13, fontWeight: FontWeight.w500))),
                Icon(icon, color: color, size: 20),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xff111827))),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xff9ca3af))),
          ],
        ),
      ),
    );
  }
}
