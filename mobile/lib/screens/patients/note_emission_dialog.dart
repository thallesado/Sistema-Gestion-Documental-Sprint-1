import 'package:flutter/material.dart';

import '../../core/i18n/app_language.dart';

/// Confirmación antes de emitir (firmar) una nota médica: DRAFT → APPROVED no tiene vuelta atrás.
Future<bool> confirmNoteEmission(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(ctx.tr('Emitir nota médica')),
      content: Text(ctx.tr('La nota quedará firmada como vigente y ya no podrá editarse; solo podrá anularse.')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ctx.tr('Cancelar'))),
        FilledButton(
          key: const Key('note-approve-confirm'),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(ctx.tr('Firmar y emitir')),
        ),
      ],
    ),
  );
  return confirmed == true;
}
