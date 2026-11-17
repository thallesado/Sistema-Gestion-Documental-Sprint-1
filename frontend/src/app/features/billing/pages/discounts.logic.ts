/** Reglas puras de descuentos y códigos promocionales (065), probadas con node --test. */

export const DISCOUNT_SOURCE_LABELS: Record<string, string> = {
  PROMOTION_CODE: 'Código promocional', LOYALTY: 'Cliente frecuente', MANUAL: 'Aprobado por la plataforma',
};

export const DISCOUNT_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Vigente', ENDED: 'Terminado', REMOVED: 'Retirado' };

/** «20 %» o «USD 10,00»; el monto se muestra con dos decimales. */
export function discountValueLabel(percentOff: number | null, amountOffUsd: number | null): string {
  if (percentOff != null) return `${Number(percentOff).toLocaleString('es-BO', { maximumFractionDigits: 2 })} %`;
  if (amountOffUsd != null) return `USD ${Number(amountOffUsd).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return '—';
}

/** Duración legible: un solo pago o N meses. */
export function durationLabel(duration: string, months: number | null): string {
  if (duration === 'REPEATING' && months) return months === 1 ? 'durante 1 mes' : `durante ${months} meses`;
  return 'en un solo pago';
}

/** Código como lo guarda el backend: mayúsculas, sin espacios. */
export function normalizePromotionCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

export function isValidPromotionCode(value: string | null | undefined): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(normalizePromotionCode(value));
}

export interface CouponForm {
  code: string; name: string; type: 'PERCENT' | 'AMOUNT'; value: number | null; duration: 'ONCE' | 'REPEATING';
  months: number | null; plans: string[]; redeemBy: string;
}

/**
 * Primer error del formulario de cupón o null. Repite las reglas del backend para avisar antes de
 * enviar: fecha de fin obligatoria y futura, tope de porcentaje y duración con fin. El tope de un monto
 * fijo lo calcula el servidor con el precio de los planes.
 */
export function couponFormError(form: CouponForm, maxPercentOff: number, now = new Date()): string | null {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(form.code.trim().toUpperCase())) return 'El código interno debe tener de 3 a 40 letras, números, guiones o guiones bajos.';
  if (!form.name.trim()) return 'Indica el nombre del cupón.';
  const value = Number(form.value);
  if (!form.value || !Number.isFinite(value) || value <= 0) return 'Indica el valor del descuento.';
  if (form.type === 'PERCENT' && value > maxPercentOff) return `El descuento supera el tope de ${maxPercentOff} %.`;
  if (form.duration === 'REPEATING' && !(Number(form.months) >= 1 && Number(form.months) <= 36 && Number.isInteger(Number(form.months)))) {
    return 'Indica la duración en meses (1 a 36).';
  }
  if (!form.plans.length) return 'Elige al menos un plan.';
  if (!form.redeemBy) return 'La fecha de fin es obligatoria.';
  if (endOfDay(form.redeemBy) <= now.getTime()) return 'La fecha de fin debe ser futura.';
  return null;
}

/** Error del formulario de código promocional o null: vencimiento obligatorio y no posterior al del cupón. */
export function promotionCodeFormError(code: string, expiresAt: string, couponRedeemBy: string, maxRedemptions: number | null, now = new Date()): string | null {
  if (!isValidPromotionCode(code)) return 'El código debe tener de 3 a 40 letras, números o guiones.';
  if (!expiresAt) return 'El vencimiento es obligatorio.';
  const expires = endOfDay(expiresAt);
  if (expires <= now.getTime()) return 'El vencimiento debe ser futuro.';
  if (expires > new Date(couponRedeemBy).getTime()) return 'El código no puede vencer después que su cupón.';
  if (maxRedemptions != null && !(Number.isInteger(Number(maxRedemptions)) && Number(maxRedemptions) >= 1)) return 'El límite de canjes debe ser un número entero positivo.';
  return null;
}

/**
 * Fecha del formulario (AAAA-MM-DD) como fin de ese día, sin pasar del límite: si el límite cae ese
 * mismo día, se usa el límite (el backend rechaza un código que vence después de su cupón).
 */
export function endOfDayIso(date: string, limit?: string): string {
  const end = endOfDay(date);
  const cap = limit ? new Date(limit).getTime() : Number.POSITIVE_INFINITY;
  return new Date(Math.min(end, cap)).toISOString();
}

function endOfDay(date: string): number {
  return new Date(`${date.slice(0, 10)}T23:59:59`).getTime();
}

/**
 * Frase del descuento vigente para «Gestionar suscripción», en un solo nodo de texto para que
 * i18nContent la traduzca con su patrón: «20 % de descuento hasta el 15/04/2026.».
 */
export function activeDiscountText(discount: { percentOff: number | null; amountOffUsd: number | null }, endsAt: string): string {
  return `${discountValueLabel(discount.percentOff, discount.amountOffUsd)} de descuento hasta el ${endsAt}.`;
}

/** Línea del resumen del checkout: «Código LANZAMIENTO2026: 20 % durante 3 meses». */
export function promotionSummary(preview: { code: string; percentOff: number | null; amountOffUsd: number | null; duration: string; durationInMonths: number | null }): string {
  return `Código ${preview.code}: ${discountValueLabel(preview.percentOff, preview.amountOffUsd)} ${durationLabel(preview.duration, preview.durationInMonths)}`;
}
