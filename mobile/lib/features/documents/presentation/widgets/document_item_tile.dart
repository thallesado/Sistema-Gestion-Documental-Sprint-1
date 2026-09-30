import 'package:flutter/material.dart';

class DocumentItemTile extends StatelessWidget {
  const DocumentItemTile({super.key, required this.doc});

  final Map<String, dynamic> doc;

  @override
  Widget build(BuildContext context) {
    final name = doc['name'] as String? ?? 'Documento sin nombre';
    final code = doc['code'] as String? ?? '';
    final status = doc['status'] as String? ?? 'DRAFT';
    final author = doc['responsibleUserName'] as String? ?? 'Sin asignar';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xffe5e7eb)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xff087f7b).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.picture_as_pdf_outlined, color: Color(0xff087f7b), size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xff111827))),
                const SizedBox(height: 2),
                Text('$code · $author', style: const TextStyle(fontSize: 11, color: Color(0xff6b7280))),
              ],
            ),
          ),
          _StatusBadge(status: status),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    Color bg = const Color(0xfff3f4f6);
    Color text = const Color(0xff4b5563);
    String label = status;

    switch (status) {
      case 'DRAFT':
        bg = const Color(0xfffef3c7); text = const Color(0xff92400e); label = 'Borrador'; break;
      case 'IN_REVIEW':
        bg = const Color(0xffdbeafe); text = const Color(0xff1e40af); label = 'Revisión'; break;
      case 'APPROVED': case 'PUBLISHED':
        bg = const Color(0xffd1fae5); text = const Color(0xff065f46); label = 'Aprobado'; break;
      case 'REJECTED':
        bg = const Color(0xfffee2e2); text = const Color(0xff991b1b); label = 'Rechazado'; break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(color: text, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}
