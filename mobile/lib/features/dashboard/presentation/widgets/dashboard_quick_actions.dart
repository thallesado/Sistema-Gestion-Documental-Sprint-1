import 'package:flutter/material.dart';

import '../../../../core/i18n/app_language.dart';

/// Acciones rápidas del inicio que no repiten las tarjetas de indicadores: escanear,
/// crear un documento y, si el usuario ve el módulo clínico, abrir pacientes.
class DashboardQuickActions extends StatelessWidget {
  const DashboardQuickActions({
    super.key,
    required this.onScan,
    required this.onNewDocument,
    this.onPatients,
  });

  final VoidCallback onScan;
  final VoidCallback onNewDocument;

  /// `null` oculta la acción porque el usuario no tiene permiso sobre la pestaña clínica.
  final VoidCallback? onPatients;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(tr('Acciones rápidas'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xff111827))),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _ActionButton(icon: Icons.document_scanner_outlined, label: tr('Escanear'), color: const Color(0xff3b82f6), onTap: onScan)),
            Expanded(child: _ActionButton(icon: Icons.note_add_outlined, label: tr('Nuevo documento'), color: const Color(0xff087f7b), onTap: onNewDocument)),
            if (onPatients != null)
              Expanded(child: _ActionButton(icon: Icons.medical_services_outlined, label: tr('Pacientes'), color: const Color(0xff10b981), onTap: onPatients!)),
          ],
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.icon, required this.label, required this.color, required this.onTap});

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
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 6),
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xff374151))),
        ],
      ),
    );
  }
}
