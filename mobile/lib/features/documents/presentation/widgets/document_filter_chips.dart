import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Filtro por estado del repositorio: "Todos" más un chip por estado de [statuses].
/// `null` como selección significa "Todos". Las etiquetas las resuelve el padre con `tr()`.
class DocumentFilterChips extends StatelessWidget {
  const DocumentFilterChips({
    super.key,
    required this.statuses,
    required this.selected,
    required this.allLabel,
    required this.labelFor,
    required this.onChanged,
  });

  final List<String> statuses;
  final String? selected;
  final String allLabel;
  final String Function(String status) labelFor;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _chip(allLabel, null),
          for (final status in statuses) _chip(labelFor(status), status),
        ],
      ),
    );
  }

  Widget _chip(String label, String? value) {
    final isSelected = selected == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onChanged(value),
        selectedColor: AppTheme.mint,
        checkmarkColor: AppTheme.teal,
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          color: isSelected ? AppTheme.teal : const Color(0xff374151),
        ),
      ),
    );
  }
}
