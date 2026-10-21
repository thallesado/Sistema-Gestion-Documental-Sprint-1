/// Reglas de `POST /documents/{id}/versions`, copiadas de `DocumentStorageService` para
/// avisar antes de enviar. El servidor vuelve a validarlas y calcula el SHA-256.
abstract final class UploadRules {
  static const maxBytes = 25 * 1024 * 1024;
  static const maxReasonLength = 1000;

  static const _mimeByExtension = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  static List<String> get allowedExtensions => _mimeByExtension.keys.toList();
  static List<String> get allowedMimeTypes => _mimeByExtension.values.toSet().toList();

  /// Tipo MIME admitido por el servidor, o `null` si la extensión no está permitida.
  static String? mimeFor(String fileName) {
    final dot = fileName.lastIndexOf('.');
    if (dot < 0 || dot == fileName.length - 1) return null;
    return _mimeByExtension[fileName.substring(dot + 1).toLowerCase()];
  }

  /// Mensaje de error para mostrar, o `null` si el archivo y el motivo son válidos.
  static String? validate({required String fileName, required int sizeBytes, required String reason}) {
    if (mimeFor(fileName) == null) return 'Formato no permitido. Usa PDF, JPG, PNG o DOCX.';
    if (sizeBytes <= 0) return 'El archivo está vacío.';
    if (sizeBytes > maxBytes) return 'El archivo supera 25 MB.';
    final trimmed = reason.trim();
    if (trimmed.isEmpty) return 'Indica el motivo de la nueva versión.';
    if (trimmed.length > maxReasonLength) return 'El motivo no puede superar $maxReasonLength caracteres.';
    return null;
  }
}
