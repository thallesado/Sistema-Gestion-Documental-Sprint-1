/** Reglas puras del catálogo de planes editable (probadas con node --test). */

export const LIMIT_KEYS = ['maxUsers', 'maxStorageMB', 'maxDocuments', 'maxOcrPagesPerMonth'] as const;

export const LIMIT_LABELS: Record<string, string> = {
  maxUsers: 'Usuarios', maxStorageMB: 'Almacenamiento (MB)', maxDocuments: 'Documentos', maxOcrPagesPerMonth: 'Páginas OCR por mes',
};

export const FEATURE_LABELS: Record<string, string> = {
  workflows: 'Workflows', ocr_scanning: 'Digitalización OCR', advanced_analytics: 'Reportes avanzados',
  clinical_module: 'Módulo clínico', dicom_imaging: 'Imagenología DICOM', custom_branding: 'Marca personalizada',
};

export function featureLabel(key: string): string { return FEATURE_LABELS[key] ?? key; }

/** Solo los valores que cambiaron; -1 = ilimitado y no se aceptan negativos menores. */
export function changedLimits(current: Record<string, number>, edited: Record<string, number | string>): Record<string, number> | null {
  const changes: Record<string, number> = {};
  for (const key of LIMIT_KEYS) {
    const raw = edited[key];
    const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
    if (value === undefined || value === null || Number.isNaN(value) || !Number.isInteger(value) || value < -1) return null;
    if (value !== current[key]) changes[key] = value;
  }
  return changes;
}

export function changedFeatures(current: { key: string; enabled: boolean }[], edited: Record<string, boolean>): Record<string, boolean> {
  const changes: Record<string, boolean> = {};
  for (const feature of current) {
    if (feature.key in edited && edited[feature.key] !== feature.enabled) changes[feature.key] = edited[feature.key];
  }
  return changes;
}

/** Un 409 CONFIRMATION_REQUIRED pide confirmar el impacto sobre organizaciones existentes, no es un error final. */
export function needsImpactConfirmation(status: number, body: { code?: string } | null | undefined): boolean {
  return status === 409 && body?.code === 'CONFIRMATION_REQUIRED';
}

export function isValidAmount(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return false;
  const amount = typeof value === 'string' ? Number(value.trim()) : Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 && Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;
}

/** Equivalente mensual de un precio anual, para mostrar el descuento del ciclo anual. */
export function annualSavingsPercent(monthly: number, annual: number): number {
  if (!monthly || monthly <= 0) return 0;
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

export interface PriceLike { billingCycle: string; archivedAt: string | null; tenants: number }

/** Clientes en versiones anteriores del mismo ciclo: los que una migración podría mover al vigente. */
export function grandfatheredTenants(prices: PriceLike[], cycle: string): number {
  return prices.filter((p) => p.billingCycle === cycle && p.archivedAt).reduce((sum, p) => sum + (Number(p.tenants) || 0), 0);
}

/** Permisos agrupados por módulo para el editor de plantillas. */
export function groupByModule<T extends { module: string }>(items: T[]): { module: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.module, [...(groups.get(item.module) ?? []), item]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([module, list]) => ({ module, items: list }));
}
