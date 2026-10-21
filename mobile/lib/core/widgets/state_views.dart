import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Mensaje de error con reintento. Sustituye a los antiguos datos de ejemplo:
/// si la API falla, el usuario lo ve en lugar de recibir información inventada.
class ErrorStateView extends StatelessWidget {
  const ErrorStateView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ListView(
    // ListView para que funcione el "tirar para actualizar" del RefreshIndicator.
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.all(32),
    children: [
      const SizedBox(height: 40),
      Icon(Icons.cloud_off_outlined, size: 48, color: Colors.grey.shade400),
      const SizedBox(height: 12),
      Text(message, key: const Key('error-state'), textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade700)),
      const SizedBox(height: 16),
      Center(
        child: OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Reintentar')),
      ),
    ],
  );
}

class EmptyStateView extends StatelessWidget {
  const EmptyStateView({super.key, required this.message, this.icon = Icons.inbox_outlined});

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.all(32),
    children: [
      const SizedBox(height: 40),
      Icon(icon, size: 44, color: Colors.grey.shade400),
      const SizedBox(height: 12),
      Text(message, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
    ],
  );
}

/// Insignia de estado con colores suaves, como los "badges" de la web.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, {super.key, this.tone = BadgeTone.neutral});

  final String label;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (tone) {
      BadgeTone.success => (const Color(0xffd1fae5), const Color(0xff065f46)),
      BadgeTone.warning => (const Color(0xfffef3c7), const Color(0xff92400e)),
      BadgeTone.danger => (const Color(0xfffee2e2), const Color(0xff991b1b)),
      BadgeTone.info => (const Color(0xffe0f2fe), const Color(0xff0369a1)),
      BadgeTone.brand => (AppTheme.mint, AppTheme.teal),
      BadgeTone.neutral => (const Color(0xfff3f4f6), const Color(0xff4b5563)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: foreground)),
    );
  }
}

enum BadgeTone { success, warning, danger, info, brand, neutral }

BadgeTone documentStatusTone(String? status) => switch (status) {
  'APPROVED' || 'CURRENT' => BadgeTone.success,
  'IN_REVIEW' => BadgeTone.info,
  'REJECTED' || 'VOIDED' => BadgeTone.danger,
  'DRAFT' || 'CORRECTED' => BadgeTone.warning,
  _ => BadgeTone.neutral,
};

BadgeTone taskStatusTone(String? status) => switch (status) {
  'COMPLETED' => BadgeTone.success,
  'IN_PROGRESS' => BadgeTone.info,
  'OVERDUE' || 'REJECTED' => BadgeTone.danger,
  'CHANGES_REQUESTED' => BadgeTone.warning,
  _ => BadgeTone.neutral,
};
