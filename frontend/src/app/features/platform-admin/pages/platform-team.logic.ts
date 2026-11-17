/** Reglas puras del equipo de plataforma (probadas con node --test). */

export const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadministrador', FINANCE: 'Finanzas', SUPPORT: 'Soporte', OPERATIONS: 'Operaciones',
};

/** Autoridades de cada acción de plataforma (las mismas que exige el backend). */
export const PLATFORM_AUTHORITIES = {
  base: 'platform:tenant:manage',
  lifecycle: 'platform:tenant:lifecycle',
  trial: 'platform:tenant:trial',
  billing: 'platform:billing:manage',
  discountApply: 'platform:discount:apply',
  backup: 'platform:backup:manage',
  support: 'platform:support:access',
  team: 'platform:team:manage',
} as const;

export function memberFormError(form: { firstName: string; lastName: string; username: string; email: string; roleCode: string; temporaryPassword: string }): string | null {
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Indica nombre y apellido.';
  if (!/^[A-Za-z0-9._-]{3,60}$/.test(form.username.trim())) return 'El usuario debe tener de 3 a 60 letras, números, puntos o guiones.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Indica un correo válido.';
  if (!ROLE_LABELS[form.roleCode]) return 'Elige un rol.';
  if (form.temporaryPassword.length < 12) return 'La contraseña temporal debe tener al menos 12 caracteres.';
  return null;
}
