/** Reglas puras de Uso de almacenamiento y Branding de organizaciones (probadas con node --test). */

export const TENANT_STATUS_LABELS: Record<string, string> = {
  TRIAL: 'En prueba', ACTIVE: 'Activa', PAST_DUE: 'Pago pendiente', SUSPENDED: 'Suspendida', EXPIRED: 'Vencida', CANCELED: 'Cancelada',
};

/** Fracción de almacenamiento usada para ordenar; ilimitado va al final. */
export function storageRatio(row: { usage: { storageBytes: { used: number; limit: number } } }): number {
  const { used, limit } = row.usage.storageBytes;
  if (limit === -1) return -1;
  if (!limit || limit <= 0) return used > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return (Number(used) || 0) / limit;
}

/** Color de marca válido (#rgb o #rrggbb) o null: el valor viene de cada organización. */
export function brandColor(value: string | null | undefined): string | null {
  return value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : null;
}

/** Solo logos por https (o rutas del propio sitio): nunca javascript: ni data:. */
export function safeLogoUrl(value: string | null | undefined): string | null {
  const url = (value ?? '').trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(url) || /^\/[^\s"'<>]*$/.test(url) ? url : null;
}

/** Iniciales para la organización sin logo. */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?';
}
