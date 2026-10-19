/**
 * Reglas puras de permisos por función (sin dependencias de Angular para poder probarlas con node --test).
 *
 * Un requisito puede ser un código (`document:read`) o una lista de códigos; con una lista basta
 * con tener cualquiera de ellos, igual que `hasAnyAuthority(...)` en el backend.
 * Un requisito ausente no restringe nada.
 */
export type PermissionRequirement = string | readonly string[];

/**
 * Administrador del tenant para suscripción, planes, precios y pagos.
 * Coincide con `PlanController.TENANT_PLAN_ADMIN` en el backend.
 */
export const TENANT_PLAN_ADMIN: readonly string[] = ['tenant:update', 'tenant:manage'];

export function hasPermission(
  granted: Iterable<string> | null | undefined,
  required: PermissionRequirement | null | undefined,
): boolean {
  if (required == null) return true;
  const codes = typeof required === 'string' ? [required] : required;
  if (codes.length === 0) return true;
  const grantedSet = granted instanceof Set ? granted as Set<string> : new Set(granted ?? []);
  return codes.some((code) => grantedSet.has(code));
}

type PermissionGated = { permission?: PermissionRequirement };
type GatedNavItem<C extends PermissionGated> = PermissionGated & { children: C[] };

/** Hijos de una entrada de menú que el usuario puede ver: los suyos propios y los heredados del padre. */
export function permittedChildren<C extends PermissionGated>(
  item: GatedNavItem<C>,
  granted: Iterable<string> | null | undefined,
): C[] {
  const grantedSet = new Set(granted ?? []);
  if (!hasPermission(grantedSet, item.permission)) return [];
  return item.children.filter((child) => hasPermission(grantedSet, child.permission));
}
