// Pure rules for the proactive help the assistant bubble offers after a failed request.
import type { AssistantErrorInfo } from './assistant-context';

export interface AssistantSuggestion {
  message: string;
  /** Question the user can send to the assistant with one click. */
  question: string;
}

/** Returns the help to offer for the last failed request, or null when nothing useful can be said. */
export function suggestionFor(error: AssistantErrorInfo | null): AssistantSuggestion | null {
  if (!error) return null;
  // Expired sessions are handled by the login flow, and the assistant must not react to its own failures.
  if (error.status === 401 || error.url.includes('/assistant/')) return null;

  if (error.url.includes('/ocr')) {
    const question = '¿Por qué falló el procesamiento OCR y qué puedo hacer?';
    if (error.status === 413) {
      return { message: 'El archivo es demasiado grande para el OCR. Prueba con una imagen más liviana y vuelve a procesarla.', question };
    }
    if (error.status === 403) {
      return { message: 'No tienes permiso para esta acción de digitalización. Pídelo a tu administrador.', question };
    }
    return {
      message: 'El procesamiento OCR falló. Puedes reintentar o revisar la imagen: que sea nítida, esté derecha y no tenga recortes.',
      question,
    };
  }

  const question = `¿Por qué falló la operación (error ${error.status}) y cómo lo resuelvo?`;
  if (error.status === 0) {
    return { message: 'No hay conexión con el servidor. Revisa tu conexión y vuelve a intentarlo.', question };
  }
  if (error.status === 403) {
    return { message: 'No tienes permiso para esta acción. Pídelo a tu administrador o pregúntame qué permiso necesitas.', question };
  }
  return { message: 'Algo falló en la última operación. ¿Quieres que te ayude a resolverlo?', question };
}
