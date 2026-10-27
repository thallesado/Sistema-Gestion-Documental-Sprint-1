/**
 * Definición del recorrido guiado (onboarding) de un solo uso: solo datos. Cada paso apunta a un
 * atributo `data-tour` del shell y nombra su texto con una clave de traducción
 * (`tour.steps.<id>.title|description` en core/i18n/tour-translations.ts), de modo que el
 * recorrido aparece en el idioma que el usuario eligió.
 */
export type OnboardingSide = 'top' | 'right' | 'bottom' | 'left';

export interface OnboardingStep {
  /** Selector CSS del elemento señalado. */
  target: string;
  /** Clave bajo `tour.steps` con el título y la descripción. */
  textKey: string;
  side: OnboardingSide;
}

/** Opción del menú lateral (etiqueta exacta de nexodocs-data). */
const menuStep = (label: string, textKey: string): OnboardingStep => ({
  target: `[data-tour-menu="${label}"]`,
  textKey,
  side: 'right',
});

/**
 * Una parada por opción del menú, en el orden del menú lateral. El recorrido solo incluye las que
 * el usuario ve según sus permisos.
 */
const MENU_STEPS: readonly OnboardingStep[] = [
  menuStep('Inicio', 'inicio'),
  menuStep('Expedientes', 'expedientes'),
  menuStep('Módulo Clínico', 'clinico'),
  menuStep('Documentos', 'documentos'),
  menuStep('Digitalizacion', 'digitalizacion'),
  menuStep('Workflows', 'workflows'),
  menuStep('Respaldos', 'respaldos'),
  menuStep('Usuarios y equipos', 'usuarios'),
  menuStep('Auditoria', 'auditoria'),
  menuStep('Facturacion e ingresos', 'facturacion'),
  menuStep('Reportes', 'reportes'),
  menuStep('Configuracion', 'configuracion'),
  menuStep('Panel de plataforma', 'plataforma'),
  menuStep('Tenants', 'tenants'),
  menuStep('Respaldo de plataforma', 'respaldoPlataforma'),
];

export const APP_TOUR_STEPS: readonly OnboardingStep[] = [
  { target: '[data-tour="navigation"]', textKey: 'navigation', side: 'right' },
  ...MENU_STEPS,
  { target: '[data-tour="primary-action"]', textKey: 'help', side: 'bottom' },
  { target: '[data-tour="profile"]', textKey: 'profile', side: 'bottom' },
];
