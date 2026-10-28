/** Reglas puras de la ficha de organización y de la auditoría de plataforma (probadas con node --test). */

export const MIN_REASON_LENGTH = 5;
export const MAX_REASON_LENGTH = 1000;

/** Mismo criterio que PlatformAuditService.requireReason: sin motivo válido el botón no se habilita. */
export function isValidReason(reason: string | null | undefined): boolean {
  const normalized = String(reason ?? '').trim().replace(/\s+/g, ' ');
  return normalized.length >= MIN_REASON_LENGTH && normalized.length <= MAX_REASON_LENGTH;
}

export interface UsageBar { percent: number; tone: 'ok' | 'warn' | 'over' | 'unlimited' }

/** Barra de consumo: -1 = ilimitado; 80 % avisa; por encima del límite se marca en rojo. */
export function usageBar(used: number, limit: number): UsageBar {
  if (limit === -1 || limit === null || limit === undefined) return { percent: 0, tone: 'unlimited' };
  if (limit <= 0) return { percent: used > 0 ? 100 : 0, tone: used > 0 ? 'over' : 'ok' };
  const ratio = (Number(used) || 0) / limit;
  return { percent: Math.min(100, Math.round(ratio * 100)), tone: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok' };
}

export function formatBytes(bytes: number): string {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const LIFECYCLE_LABELS: Record<string, string> = {
  TRIAL: 'En prueba', ACTIVE: 'Activo', PAST_DUE: 'Pago pendiente', EXPIRED: 'Vencido', SUSPENDED: 'Suspendido',
  CANCELED: 'Cancelado', PENDING_DELETION: 'Cancelado, en período de gracia', PURGED: 'Eliminado definitivamente',
};

export const ACTION_LABELS: Record<string, string> = {
  TENANT_CREATED: 'Alta de organización',
  TENANT_SUSPENDED: 'Suspensión',
  TENANT_REACTIVATED: 'Reactivación',
  TENANT_STATUS_CHANGED: 'Cambio de estado',
  TENANT_TRIAL_EXTENDED: 'Prueba extendida',
  TENANT_PLAN_CHANGED: 'Cambio de plan manual',
  PLATFORM_BACKUP_REQUESTED: 'Respaldo completo solicitado',
  SUBSCRIPTION_UPGRADED: 'Mejora de plan',
  SUBSCRIPTION_CHANGE_SCHEDULED: 'Cambio de plan programado',
  SUBSCRIPTION_CHANGE_UNSCHEDULED: 'Cambio programado anulado',
  SUBSCRIPTION_CHANGE_APPLIED: 'Cambio programado aplicado',
  SUBSCRIPTION_RENEWAL_STOPPED: 'No renovar',
  SUBSCRIPTION_RENEWAL_RESUMED: 'Renovación reanudada',
  SUBSCRIPTION_CANCELED: 'Cancelación',
  SUBSCRIPTION_ENDED: 'Suscripción terminada',
  TENANT_PURGED: 'Borrado definitivo',
  PLAN_UPDATED: 'Plan editado',
  PLAN_LIMITS_UPDATED: 'Límites del plan',
  PLAN_FEATURES_UPDATED: 'Funcionalidades del plan',
  PLAN_PRICE_CHANGED: 'Precio del plan',
  PLAN_PRICE_MIGRATION_SCHEDULED: 'Migración de precio programada',
  ROLE_TEMPLATE_CREATED: 'Grupo por defecto creado',
  ROLE_TEMPLATE_UPDATED: 'Grupo por defecto editado',
  ROLE_TEMPLATE_DELETED: 'Grupo por defecto eliminado',
  ADDON_CREATED: 'Complemento creado',
  ADDON_UPDATED: 'Complemento editado',
  ADDON_PRICE_CHANGED: 'Precio de complemento',
  TENANT_ADDON_GRANTED: 'Complemento de cortesía',
  TENANT_ADDON_REVOKED: 'Cortesía retirada',
  SUBSCRIPTION_PRICE_CHANGE_SCHEDULED: 'Cambio de precio programado',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Acciones disponibles en la ficha según el estado del ciclo de vida (el backend vuelve a validarlas). */
export function availableActions(state: string, stripeManaged: boolean): { suspend: boolean; reactivate: boolean; extendTrial: boolean; changePlan: boolean } {
  return {
    suspend: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED'].includes(state),
    reactivate: ['SUSPENDED', 'EXPIRED', 'PENDING_DELETION'].includes(state),
    extendTrial: !stripeManaged && ['TRIAL', 'EXPIRED'].includes(state),
    changePlan: !stripeManaged && ['TRIAL', 'ACTIVE', 'PAST_DUE'].includes(state),
  };
}

/** Un 402 con code PLAN_LIMIT_EXCEEDED en el cambio de plan pide confirmación, no es un error final. */
export function needsOverLimitConfirmation(status: number, body: { code?: string } | null | undefined): boolean {
  return status === 402 && body?.code === 'PLAN_LIMIT_EXCEEDED';
}

/** Muestra el JSON de antes/después como «clave: valor» legible. */
export function describeState(json: string | null | undefined): string {
  if (!json) return '—';
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    const parts = Object.entries(value).filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : String(v)}`);
    return parts.length ? parts.join(' · ') : '—';
  } catch {
    return json;
  }
}
