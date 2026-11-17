import '../../core/i18n/app_language.dart';
import '../../core/widgets/state_views.dart';

/// Catálogos del módulo clínico con las mismas opciones que los formularios de la web.
const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const allergySeverities = ['LOW', 'MEDIUM', 'HIGH'];

const noteTypes = ['EVOLUTION', 'PRESCRIPTION', 'CONSULTATION'];

const patientDocumentTypes = ['CI', 'SEGURO', 'PASAPORTE'];

const patientGenders = ['MASCULINO', 'FEMENINO', 'OTRO'];

String severityLabel(String? severity) => switch (severity) {
  'LOW' => tr('Baja (leve)'),
  'MEDIUM' => tr('Media (moderada)'),
  'HIGH' => tr('Alta (grave)'),
  _ => severity ?? '—',
};

BadgeTone severityTone(String? severity) => switch (severity) {
  'HIGH' => BadgeTone.danger,
  'MEDIUM' => BadgeTone.warning,
  _ => BadgeTone.info,
};

String noteTypeLabel(String? type) => switch (type) {
  'EVOLUTION' => tr('Nota de evolución'),
  'PRESCRIPTION' => tr('Receta médica'),
  'CONSULTATION' => tr('Consulta'),
  _ => type ?? tr('Nota'),
};

String noteStatusLabel(String? status) => switch (status) {
  'DRAFT' => tr('Borrador'),
  'APPROVED' => tr('Vigente'),
  'VOIDED' => tr('Anulada'),
  _ => status ?? '—',
};

BadgeTone noteStatusTone(String? status) => switch (status) {
  'APPROVED' => BadgeTone.success,
  'VOIDED' => BadgeTone.danger,
  _ => BadgeTone.warning,
};

String patientDocumentTypeLabel(String? type) => switch (type) {
  'CI' => tr('Cédula de identidad (CI)'),
  'SEGURO' => tr('Seguro'),
  'PASAPORTE' => tr('Pasaporte'),
  _ => type ?? '—',
};

String patientStatusLabel(String? status) => switch (status) {
  'ACTIVE' => tr('Activo'),
  'INACTIVE' => tr('Inactivo'),
  _ => status ?? '—',
};

String genderLabel(String? gender) => switch (gender) {
  'MASCULINO' => tr('Masculino'),
  'FEMENINO' => tr('Femenino'),
  'OTRO' => tr('Otro'),
  _ => gender ?? '—',
};

/// Evento de `GET /clinical-histories/{id}/timeline`.
String timelineEventLabel(String? type) => switch (type) {
  'CLINICAL_HISTORY_OPENED' => tr('Apertura de historia'),
  'EPISODE' => tr('Episodio clínico'),
  'MEDICAL_NOTE' => tr('Nota médica'),
  'DOCUMENT' => tr('Documento'),
  _ => type ?? tr('Evento'),
};

/// Las notas de la web se guardan como HTML sencillo; en el móvil se muestran como texto.
String plainText(String? html) {
  if (html == null) return '';
  return html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</p>\s*', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&amp;', '&')
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}

/// Texto del usuario convertido en el HTML seguro que espera la web (párrafos y saltos de línea).
String toNoteHtml(String text) {
  String escape(String value) => value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  return text
      .trim()
      .split(RegExp(r'\n\s*\n'))
      .where((paragraph) => paragraph.trim().isNotEmpty)
      .map((paragraph) => '<p>${escape(paragraph.trim()).replaceAll('\n', '<br>')}</p>')
      .join();
}
