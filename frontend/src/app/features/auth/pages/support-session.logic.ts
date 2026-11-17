/** Reglas puras de la sesión de soporte (probadas con node --test). */

/** Token del fragmento `#token=...`; solo un JWT con forma válida. */
export function supportTokenFromHash(hash: string | null | undefined): string | null {
  const params = new URLSearchParams((hash ?? '').replace(/^#/, ''));
  const token = params.get('token');
  return token && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

/** URL de la pestaña de soporte; el token va en el fragmento para que no llegue a ningún servidor ni registro. */
export function supportSessionUrl(token: string): string {
  return `/support-session#token=${encodeURIComponent(token)}`;
}

/** Minutos que le quedan a la sesión (0 si venció). */
export function minutesLeft(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
}

/** Módulos que se pueden solicitar (SupportAccessService.MODULES en el backend). */
export const SUPPORT_MODULE_LABELS: Record<string, string> = {
  DOCUMENTS: 'Documentos', EXPEDIENTS: 'Expedientes', WORKFLOWS: 'Workflows y tareas', USERS: 'Usuarios y grupos',
  CLINICAL: 'Módulo clínico', AUDIT: 'Auditoría', REPORTS: 'Reportes', CONFIGURATION: 'Configuración',
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  PENDING_TENANT: 'Esperando a la organización', PENDING_INTERNAL: 'Esperando aprobaciones internas', APPROVED: 'Vigente',
  EXPIRED: 'Vencido', REJECTED: 'Rechazado', REVOKED: 'Revocado', CANCELED: 'Anulado',
};

/** Reglas del formulario de solicitud: módulos, duración de 15 a 240 minutos y motivo. */
export function supportRequestError(tenantId: string, modules: string[], minutes: number, reason: string): string | null {
  if (!tenantId) return 'Elige la organización.';
  if (!modules.length) return 'Elige al menos un módulo.';
  if (!Number.isInteger(Number(minutes)) || Number(minutes) < 15 || Number(minutes) > 240) return 'La duración debe ser de 15 a 240 minutos.';
  if (reason.trim().length < 5) return 'Indica el motivo (mínimo 5 caracteres).';
  return null;
}
