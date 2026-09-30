import 'package:flutter/material.dart';

class DocumentFilterChips extends StatelessWidget {
  const DocumentFilterChips({
    super.key,
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  final String selectedFilter;
  final ValueChanged<String> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    final filters = [
      {'key': '', 'label': 'Todos'},
      {'key': 'mine', 'label': 'Mis Documentos'},
      {'key': 'IN_REVIEW', 'label': 'En Revisión'},
      {'key': 'APPROVED', 'label': 'Aprobados'},
      {'key': 'DRAFT', 'label': 'Borradores'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: filters.map((f) {
          final isSelected = selectedFilter == f['key'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(f['label']!),
              selected: isSelected,
              onSelected: (_) => onFilterChanged(f['key']!),
              selectedColor: const Color(0xff087f7b).withValues(alpha: 0.15),
              checkmarkColor: const Color(0xff087f7b),
              labelStyle: TextStyle(
                color: isSelected ? const Color(0xff087f7b) : const Color(0xff4b5563),
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                fontSize: 12,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
