/**
 * Reglas puras de la pantalla de suscripción (sin Angular, para probarlas con node --test).
 * La autoridad es el backend (SubscriptionLifecycleService); esto solo decide qué botones mostrar.
 */
export type PlanDirection = 'current' | 'upgrade' | 'downgrade';

export interface PricedPlan { code: string; priceMonthly: number; priceYearly: number; }

/** Compara el plan con el actual en el ciclo elegido; el mismo plan en otro ciclo cuenta como cambio. */
export function planDirection(
  plan: PricedPlan,
  currentCode: string | null,
  currentCycle: 'MONTHLY' | 'ANNUAL',
  selectedCycle: 'MONTHLY' | 'ANNUAL',
  catalog: readonly PricedPlan[] = [],
): PlanDirection {
  if (plan.code === currentCode && selectedCycle === currentCycle) return 'current';
  const current = catalog.find((entry) => entry.code === currentCode);
  const price = (entry: PricedPlan, cycle: 'MONTHLY' | 'ANNUAL') => (cycle === 'ANNUAL' ? entry.priceYearly / 12 : entry.priceMonthly);
  if (!current) return 'upgrade';
  return price(plan, selectedCycle) > price(current, currentCycle) ? 'upgrade' : 'downgrade';
}
