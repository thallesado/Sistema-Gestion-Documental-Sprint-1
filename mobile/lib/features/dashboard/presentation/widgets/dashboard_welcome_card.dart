import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Banner de bienvenida del inicio: organización del usuario y saludo ya traducido por el padre.
class DashboardWelcomeCard extends StatelessWidget {
  const DashboardWelcomeCard({
    super.key,
    required this.greeting,
    required this.tenantName,
    required this.summary,
  });

  final String greeting;
  final String tenantName;
  final String summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppTheme.teal, AppTheme.tealDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.domain, color: Colors.white, size: 14),
                const SizedBox(width: 4),
                Text(tenantName, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
            greeting,
            key: const Key('dashboard-greeting'),
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(summary, style: const TextStyle(color: AppTheme.mint, fontSize: 13)),
        ],
      ),
    );
  }
}
