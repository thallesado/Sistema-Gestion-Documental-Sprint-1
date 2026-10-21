/// Etiquetas y formatos compartidos; coinciden con los textos de la web.
const documentStatusLabels = {
  'DRAFT': 'Borrador',
  'PENDING': 'Pendiente',
  'IN_REVIEW': 'En revisión',
  'APPROVED': 'Aprobado',
  'REJECTED': 'Rechazado',
  'CORRECTED': 'Corregido',
  'CURRENT': 'Vigente',
  'ARCHIVED': 'Archivado',
  'VOIDED': 'Anulado',
};

const taskStatusLabels = {
  'PENDING': 'Pendiente',
  'IN_PROGRESS': 'En progreso',
  'COMPLETED': 'Completada',
  'OVERDUE': 'Vencida',
  'CHANGES_REQUESTED': 'Devuelta',
  'REJECTED': 'Rechazada',
  'CANCELED': 'Cancelada',
};

const stageTypeLabels = {
  'TASK': 'Tarea',
  'REVIEW': 'Revisión',
  'APPROVAL': 'Aprobación',
  'NOTIFICATION': 'Notificación',
};

/// Mismas etiquetas que eventLabel() de la página de workflows web.
const workflowEventLabels = {
  'STARTED': 'Workflow iniciado',
  'STEP_STARTED': 'Etapa iniciada',
  'STEP_COMPLETED': 'Etapa completada',
  'STAGE_COMPLETED': 'Etapa completada',
  'TASK_ASSIGNED': 'Tarea asignada',
  'APPROVED': 'Aprobación registrada',
  'REJECTED': 'Rechazo registrado',
  'RETURNED': 'Devuelto para corrección',
  'COMMENTED': 'Comentario añadido',
  'PAUSE': 'Workflow pausado',
  'PAUSED': 'Workflow pausado',
  'RESUME': 'Workflow reanudado',
  'RESUMED': 'Workflow reanudado',
  'CANCEL': 'Workflow cancelado',
  'CANCELED': 'Workflow cancelado',
  'COMPLETED': 'Workflow finalizado',
  'EDITED': 'Workflow editado',
  'TASK_DUE_SOON': 'Aviso de vencimiento',
  'TASK_EXPIRED': 'Tarea vencida',
};

String workflowEventLabel(String? code) => workflowEventLabels[code] ?? code ?? 'Evento';

String documentStatusLabel(String? code) => documentStatusLabels[code] ?? code ?? '—';
String taskStatusLabel(String? code) => taskStatusLabels[code] ?? code ?? '—';
String stageTypeLabel(String? code) => stageTypeLabels[code] ?? code ?? '—';

String priorityLabel(Object? priority) => switch (priority) {
  1 => 'Urgente',
  2 => 'Alta',
  3 => 'Media',
  _ => 'Baja',
};

String _two(int value) => value.toString().padLeft(2, '0');

/// dd/MM/yyyy (y HH:mm si [withTime]) en hora local; '—' si no hay fecha válida.
String formatDate(Object? value, {bool withTime = false}) {
  if (value == null) return '—';
  final date = DateTime.tryParse(value.toString())?.toLocal();
  if (date == null) return value.toString();
  final day = '${_two(date.day)}/${_two(date.month)}/${date.year}';
  return withTime ? '$day ${_two(date.hour)}:${_two(date.minute)}' : day;
}

String formatBytes(Object? bytes) {
  final value = (bytes is num) ? bytes.toDouble() : double.tryParse('$bytes') ?? 0;
  if (value < 1024) return '${value.toStringAsFixed(0)} B';
  if (value < 1024 * 1024) return '${(value / 1024).toStringAsFixed(1)} KB';
  return '${(value / (1024 * 1024)).toStringAsFixed(1)} MB';
}

bool isPast(Object? value) {
  final date = value == null ? null : DateTime.tryParse(value.toString());
  return date != null && date.isBefore(DateTime.now());
}
