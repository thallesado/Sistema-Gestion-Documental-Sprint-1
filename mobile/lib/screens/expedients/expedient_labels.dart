import '../../core/i18n/app_language.dart';
import '../../core/widgets/state_views.dart';

/// Estados de `Expedient.ExpedientStatus` con las etiquetas de la web.
const expedientStatuses = ['ACTIVE', 'CLOSED', 'ARCHIVED', 'BLOCKED'];

String expedientStatusLabel(String? status) => switch (status) {
  'ACTIVE' => tr('Activo'),
  'CLOSED' => tr('Cerrado'),
  'ARCHIVED' => tr('Archivado'),
  'BLOCKED' => tr('Bloqueado'),
  _ => status ?? '—',
};

BadgeTone expedientStatusTone(String? status) => switch (status) {
  'ACTIVE' => BadgeTone.success,
  'CLOSED' => BadgeTone.info,
  'ARCHIVED' => BadgeTone.neutral,
  'BLOCKED' => BadgeTone.danger,
  _ => BadgeTone.neutral,
};
