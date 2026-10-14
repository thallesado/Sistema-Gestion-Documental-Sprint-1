// Turns an HTTP failure from POST /api/v1/ocr/process into a message a user can act on.

const GENERIC = 'Error al procesar el documento con IA multimodal';

export function describeOcrError(error: unknown): string {
  const err = error as { status?: number; error?: { message?: string } | string; message?: string } | null;
  const status = err?.status;
  if (status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  if (status === 413) return 'El archivo es demasiado grande para el servidor. Usa una imagen más liviana.';
  if (status === 401) return 'Tu sesión expiró. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permiso para procesar documentos con OCR.';
  if (status === 502 || status === 503 || status === 504) {
    return 'El servicio de visión tardó demasiado o no está disponible. Inténtalo de nuevo en unos minutos.';
  }
  const apiMessage = typeof err?.error === 'object' ? err.error?.message : undefined;
  return apiMessage || GENERIC;
}
