/** Reglas puras de los complementos (probadas con node --test). */

export const RESOURCE_LABELS: Record<string, string> = {
  maxUsers: 'Usuarios', maxStorageMB: 'Almacenamiento', maxOcrPagesPerMonth: 'Páginas OCR',
};

/** Cantidad legible de una unidad: 10240 MB → «10 GB», 5 usuarios, 1.000 páginas. */
export function quantityLabel(resource: string, quantity: number): string {
  const value = Number(quantity) || 0;
  if (resource === 'maxStorageMB') {
    return value >= 1024 && value % 1024 === 0 ? `${value / 1024} GB` : `${value} MB`;
  }
  if (resource === 'maxUsers') return `${value} usuario${value === 1 ? '' : 's'}`;
  return `${value.toLocaleString('es-BO')} páginas`;
}

export function addonTotal(price: number, units: number): number {
  return Math.round((Number(price) || 0) * Math.max(0, Math.floor(Number(units) || 0)) * 100) / 100;
}

export function validUnits(units: number | string): boolean {
  const value = Number(units);
  return Number.isInteger(value) && value >= 1 && value <= 100;
}

/** Medios de pago posibles: un recurrente con suscripción de Stripe va en la misma suscripción (tarjeta). */
export function paymentMethodsFor(kind: string, stripeSubscription: boolean, stripeReady: boolean): string[] {
  if (kind === 'RECURRING' && stripeSubscription) return stripeReady ? ['STRIPE_CARD'] : [];
  const manual = ['BANK_QR', 'CRYPTO_USDT'];
  if (kind === 'CONSUMABLE' && stripeReady) return ['STRIPE_CARD', ...manual];
  return manual;
}

/** Solo lo comprado con la suscripción de Stripe se reduce; cortesías y pagos manuales vencen solos. */
export function canReduce(addon: { stripeManaged: boolean; kind: string; pendingUnits: number | null }): boolean {
  return addon.stripeManaged && addon.kind === 'RECURRING';
}
