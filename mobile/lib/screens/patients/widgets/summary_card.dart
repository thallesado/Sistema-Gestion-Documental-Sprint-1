import 'package:flutter/material.dart';

class SummaryCard extends StatelessWidget {
  const SummaryCard({super.key, required this.summary});
  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final allergies = (summary['allergies'] as List<dynamic>? ?? []);
    final diagnoses = (summary['baseDiagnoses'] as List<dynamic>? ?? []);
    final notes = (summary['recentNotes'] as List<dynamic>? ?? []);
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              summary['patientName'] as String? ?? '',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text(summary['document'] as String? ?? ''),
            const Divider(),
            Text('Alergias', style: Theme.of(context).textTheme.titleMedium),
            Text(
              allergies.isEmpty
                  ? 'Ninguna registrada'
                  : allergies
                        .map(
                          (item) => (item as Map<String, dynamic>)['allergen'],
                        )
                        .join(', '),
            ),
            const SizedBox(height: 12),
            Text(
              'Diagnósticos',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              diagnoses.isEmpty
                  ? 'Ninguno registrado'
                  : diagnoses
                        .map(
                          (item) =>
                              (item as Map<String, dynamic>)['description'],
                        )
                        .join(', '),
            ),
            const SizedBox(height: 12),
            Text(
              'Notas recientes',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (notes.isEmpty) const Text('Sin notas recientes'),
            ...notes.map((item) {
              final note = item as Map<String, dynamic>;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(note['type'] as String? ?? 'Nota'),
                subtitle: Text(note['content'] as String? ?? ''),
              );
            }),
          ],
        ),
      ),
    );
  }
}
